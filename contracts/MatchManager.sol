// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title MatchManager
 * @dev Coordinates Beexoccer turn-based wagers on Polygon. Each lobby is created with
 *      a goal target, an optional stake, and the token address representing that stake.
 *      The contract escrows funds for the two players and releases the full pot to the
 *      declared winner once the on-chain result is reported by either participant or a
 *      future referee module (see TODO at bottom).
 */
contract MatchManager is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    address public owner;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    struct Match {
        address creator; // Player that opened the lobby.
        address challenger; // Player that joined the lobby (if any so far).
        address winner; // Address reported as winner; zero address while match is active.
        uint8 goalsTarget; // Win condition (2, 3, or 5 goals are recommended by front-end).
        bool isFree; // Free matches skip escrow logic entirely.
        bool isOpen; // Stays true until another player joins.
        bool isCompleted; // Prevents double settlements.
        uint256 stakeAmount; // Amount each participant must lock.
        address stakeToken; // ERC-20 token for escrow. Address(0) means native MATIC.
        // Timeout for abandoned matches (e.g. 24 hours)
        uint256 createdAt;
        bool timeoutClaimed;
    }

    uint256 public matchCount; // Sequential identifier for new matches.
    mapping(uint256 => Match) public matches; // Storage for all lobbies.
    // For result signature verification
    address public trustedSigner;

    event MatchCreated(uint256 indexed matchId, address indexed creator, uint8 goalsTarget, bool isFree);
    event MatchJoined(uint256 indexed matchId, address indexed challenger);
    event MatchResult(uint256 indexed matchId, address indexed winner, uint256 totalPayout);
    event MatchCancelled(uint256 indexed matchId, address indexed creator, uint256 refundAmount);
    event MatchTimeoutClaimed(uint256 indexed matchId, address indexed claimer);

    error InvalidGoalTarget();
    error InvalidStakeCombo();
    error MatchClosed();
    error MatchAlreadyCompleted();
    error NotParticipant();
    error NotWinner();
    error InvalidSignature();
    error TimeoutNotReached();
    error TimeoutAlreadyClaimed();
    error SelfJoinNotAllowed();
    error ChallengerAlreadySet();
    error NotCreator();
    error MatchNotOpen();

    /**
     * @notice Opens a new match lobby. If `isFree` is false the creator must transfer stake tokens up-front.
     * @param goalsTarget Selected win condition (frontend limits to 2/3/5 but contract simply bounds 1..10).
     * @param isFree Toggle to skip escrow entirely for bot games or casual play.
     * @param stakeAmount Amount each side must deposit. Ignored when `isFree` is true.
     * @param stakeToken ERC-20 address used for escrow. Use address(0) to denominate in native MATIC.
     */
    function createMatch(
        uint8 goalsTarget,
        bool isFree,
        uint256 stakeAmount,
        address stakeToken
    ) external payable returns (uint256 matchId) {
        if (goalsTarget == 0 || goalsTarget > 10) revert InvalidGoalTarget();
        if (!isFree && stakeAmount == 0) revert InvalidStakeCombo();
        if (isFree && (stakeAmount != 0 || stakeToken != address(0))) revert InvalidStakeCombo();

        if (!isFree) {
            _pullStake(stakeToken, stakeAmount);
        } else if (msg.value > 0) {
            revert InvalidStakeCombo();
        }

        matchId = ++matchCount;

        matches[matchId] = Match({
            creator: msg.sender,
            challenger: address(0),
            winner: address(0),
            goalsTarget: goalsTarget,
            isFree: isFree,
            isOpen: true,
            isCompleted: false,
            stakeAmount: stakeAmount,
            stakeToken: stakeToken,
            createdAt: block.timestamp,
            timeoutClaimed: false
        });

        emit MatchCreated(matchId, msg.sender, goalsTarget, isFree);
    }

    /**
     * @notice Joins an existing match. Must deposit the same stake amount when applicable.
     */
    function joinMatch(uint256 matchId) external payable {
        Match storage matchInfo = matches[matchId];
        if (!matchInfo.isOpen) revert MatchClosed();
        if (matchInfo.challenger != address(0)) revert ChallengerAlreadySet();
        if (msg.sender == matchInfo.creator) revert SelfJoinNotAllowed();

        matchInfo.challenger = msg.sender;
        matchInfo.isOpen = false;

        if (!matchInfo.isFree) {
            _pullStake(matchInfo.stakeToken, matchInfo.stakeAmount);
        } else if (msg.value > 0) {
            revert InvalidStakeCombo();
        }

        emit MatchJoined(matchId, msg.sender);
    }

    /**
     * @notice Cancels an open match and refunds the creator's stake.
     * @param matchId Lobby to cancel.
     */
    function cancelMatch(uint256 matchId) external {
        Match storage matchInfo = matches[matchId];
        if (msg.sender != matchInfo.creator) revert NotCreator();
        if (!matchInfo.isOpen) revert MatchNotOpen();
        if (matchInfo.challenger != address(0)) revert ChallengerAlreadySet();

        matchInfo.isOpen = false;
        matchInfo.isCompleted = true;

        uint256 refundAmount = 0;
        if (!matchInfo.isFree) {
            refundAmount = matchInfo.stakeAmount;
            _pushStake(matchInfo.stakeToken, matchInfo.creator, refundAmount);
        }

        emit MatchCancelled(matchId, msg.sender, refundAmount);
    }

    /**
     * @notice Records the result and releases escrow. Only the winner can call this method.
     * @param matchId Lobby to settle.
     * @param winner Address of the winning wallet (must be creator or challenger).
     * @param signature ECDSA signature from trustedSigner (optional if trustedSigner is address(0))
     */
    function reportResult(
        uint256 matchId,
        address winner,
        bytes calldata signature
    ) external nonReentrant {
        Match storage matchInfo = matches[matchId];
        if (matchInfo.isCompleted) revert MatchAlreadyCompleted();
        if (msg.sender != matchInfo.creator && msg.sender != matchInfo.challenger) revert NotParticipant();
        if (winner != matchInfo.creator && winner != matchInfo.challenger) revert NotParticipant();
        if (msg.sender != winner) revert NotWinner();

        // Validate signature only if trustedSigner is set
        // If trustedSigner is address(0), signature verification is skipped (trust the winner)
        if (trustedSigner != address(0)) {
            bytes32 messageHash = keccak256(abi.encodePacked(matchId, winner));
            bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
            address recovered = ECDSA.recover(ethSignedMessageHash, signature);
            if (recovered != trustedSigner) revert InvalidSignature();
        }

        matchInfo.winner = winner;
        matchInfo.isCompleted = true;

        uint256 totalPayout;
        if (!matchInfo.isFree) {
            totalPayout = matchInfo.stakeAmount * 2;
            _pushStake(matchInfo.stakeToken, winner, totalPayout);
        }

        emit MatchResult(matchId, winner, totalPayout);
    }

    /**
     * @dev Pulls stake tokens from the caller into escrow. Supports native MATIC when stakeToken == address(0).
     */
    function _pullStake(address stakeToken, uint256 amount) private {
        if (stakeToken == address(0)) {
            if (msg.value != amount) revert InvalidStakeCombo();
        } else {
            IERC20 token = IERC20(stakeToken);
            token.safeTransferFrom(msg.sender, address(this), amount);
        }
    }

    /**
     * @dev Pushes escrowed stake to the winner.
     */
    function _pushStake(address stakeToken, address to, uint256 amount) private {
        if (stakeToken == address(0)) {
            (bool sent, ) = payable(to).call{value: amount}("");
            require(sent, "NATIVE_SEND_FAILED");
        } else {
            IERC20 token = IERC20(stakeToken);
            token.safeTransfer(to, amount);
        }
    }

    // Timeout claim: if match is not completed after X seconds, allow refund
    uint256 public constant MATCH_TIMEOUT = 1 days;
    function claimTimeout(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.isCompleted || m.timeoutClaimed) revert TimeoutAlreadyClaimed();
        if (block.timestamp < m.createdAt + MATCH_TIMEOUT) revert TimeoutNotReached();
        m.timeoutClaimed = true;
        // Refund both players if joined, else only creator
        if (m.challenger != address(0)) {
            if (!m.isFree) {
                _pushStake(m.stakeToken, m.creator, m.stakeAmount);
                _pushStake(m.stakeToken, m.challenger, m.stakeAmount);
            }
        } else {
            if (!m.isFree) {
                _pushStake(m.stakeToken, m.creator, m.stakeAmount);
            }
        }
        emit MatchTimeoutClaimed(matchId, msg.sender);
    }

    // Admin: set trusted signer (only owner)
    function setTrustedSigner(address signer) external onlyOwner {
        trustedSigner = signer;
    }
    
    // Admin: transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    // ---------------------------------------------------------------------
    // TODO: Add automated arbitration / dispute resolution via signed match
    //       snapshots so that either player can prove victory without trust.
    // ---------------------------------------------------------------------
}
