// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MatchManager
 * @dev Coordinates Beexoccer turn-based wagers on Polygon. Each lobby is created with
 *      a goal target, an optional stake, and the token address representing that stake.
 *      The contract escrows funds for the two players and releases the full pot to the
 *      declared winner once the on-chain result is reported by either participant or a
 *      future referee module (see TODO at bottom).
 */
contract MatchManager {
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
    }

    uint256 public matchCount; // Sequential identifier for new matches.
    mapping(uint256 => Match) public matches; // Storage for all lobbies.

    event MatchCreated(uint256 indexed matchId, address indexed creator, uint8 goalsTarget, bool isFree);
    event MatchJoined(uint256 indexed matchId, address indexed challenger);
    event MatchResult(uint256 indexed matchId, address indexed winner, uint256 totalPayout);

    error InvalidGoalTarget();
    error InvalidStakeCombo();
    error MatchClosed();
    error MatchAlreadyCompleted();
    error NotParticipant();
    error ChallengerAlreadySet();

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
            stakeToken: stakeToken
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
     * @notice Records the result and releases escrow. Anyone who participated can call this method.
     * @param matchId Lobby to settle.
     * @param winner Address of the winning wallet (must be creator or challenger).
     */
    function reportResult(uint256 matchId, address winner) external {
        Match storage matchInfo = matches[matchId];
        if (matchInfo.isCompleted) revert MatchAlreadyCompleted();
        if (msg.sender != matchInfo.creator && msg.sender != matchInfo.challenger) revert NotParticipant();
        if (winner != matchInfo.creator && winner != matchInfo.challenger) revert NotParticipant();

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
            bool ok = token.transferFrom(msg.sender, address(this), amount);
            require(ok, "TRANSFER_FAILED");
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
            bool ok = token.transfer(to, amount);
            require(ok, "TRANSFER_FAILED");
        }
    }

    // ---------------------------------------------------------------------
    // TODO: Add automated arbitration / dispute resolution via signed match
    //       snapshots so that either player can prove victory without trust.
    // ---------------------------------------------------------------------
}
