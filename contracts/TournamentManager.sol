// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TournamentManager
 * @dev Manages Beexoccer tournaments with entry fees and prize distribution.
 */
contract TournamentManager is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    enum TournamentState { Open, Active, Completed, Cancelled }

    struct Tournament {
        address creator;
        uint256 entryFee;
        address entryToken; // Address(0) for native MATIC/POL
        uint8 size; // 4, 8, 16
        uint8 playerCount; // Current number of players
        TournamentState state;
        uint256 totalPrizePool;
        address winner;
        address[] players;
    }

    uint256 public tournamentCount;
    mapping(uint256 => Tournament) public tournaments;
    
    // Mapping to check if user is in tournament
    mapping(uint256 => mapping(address => bool)) public isPlayerInTournament;

    event TournamentCreated(uint256 indexed tournamentId, address indexed creator, uint256 entryFee, uint8 size);
    event PlayerJoined(uint256 indexed tournamentId, address indexed player);
    event TournamentStarted(uint256 indexed tournamentId);
    event TournamentEnded(uint256 indexed tournamentId, address indexed winner, uint256 prizeAmount);
    event TournamentCancelled(uint256 indexed tournamentId);

    error InvalidTournamentSize();
    error TournamentNotOpen();
    error TournamentFull();
    error AlreadyJoined();
    error InvalidEntryFee();
    error NotCreator();
    error TournamentNotActive();
    error NotOwner();

    function createTournament(
        uint8 size,
        uint256 entryFee,
        address entryToken
    ) external returns (uint256 tournamentId) {
        if (size != 4 && size != 8 && size != 16) revert InvalidTournamentSize();
        
        tournamentId = ++tournamentCount;
        
        Tournament storage t = tournaments[tournamentId];
        t.creator = msg.sender;
        t.entryFee = entryFee;
        t.entryToken = entryToken;
        t.size = size;
        t.state = TournamentState.Open;
        t.players = new address[](0);

        emit TournamentCreated(tournamentId, msg.sender, entryFee, size);
    }

    function joinTournament(uint256 tournamentId) external payable nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        
        if (t.state != TournamentState.Open) revert TournamentNotOpen();
        if (t.playerCount >= t.size) revert TournamentFull();
        if (isPlayerInTournament[tournamentId][msg.sender]) revert AlreadyJoined();
        
        // Handle payment
        if (t.entryToken == address(0)) {
            if (msg.value != t.entryFee) revert InvalidEntryFee();
        } else {
            if (msg.value > 0) revert InvalidEntryFee(); // Don't send ETH for token tournaments
            IERC20(t.entryToken).safeTransferFrom(msg.sender, address(this), t.entryFee);
        }

        t.players.push(msg.sender);
        t.playerCount++;
        isPlayerInTournament[tournamentId][msg.sender] = true;
        t.totalPrizePool += t.entryFee;

        emit PlayerJoined(tournamentId, msg.sender);

        if (t.playerCount == t.size) {
            t.state = TournamentState.Active;
            emit TournamentStarted(tournamentId);
        }
    }

    // Allow creator to cancel if not full (or maybe add timeout)
    function cancelTournament(uint256 tournamentId) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        if (msg.sender != t.creator && msg.sender != owner) revert NotCreator();
        if (t.state != TournamentState.Open) revert TournamentNotOpen();
        
        t.state = TournamentState.Cancelled;
        
        // Refund all players
        for (uint i = 0; i < t.players.length; i++) {
            _pushFunds(t.entryToken, t.players[i], t.entryFee);
        }
        
        emit TournamentCancelled(tournamentId);
    }

    // Simplified payout: Owner (server) tells who won. 
    // In a real decentralized version, this would be computed from match results.
    // Assuming winner takes all or specific distribution.
    // For now, let's implement Winner Takes All or simple distribution (70/30 etc) based on the frontend logic.
    // Frontend logic:
    // Size 4: 100% to 1st
    // Size 8: 75% to 1st, 25% to 2nd
    // Size 16: 70% to 1st, 20% to 2nd, 10% to 3rd
    
    function distributePrizes(
        uint256 tournamentId,
        address firstPlace,
        address secondPlace,
        address thirdPlace
    ) external onlyOwner nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        if (t.state != TournamentState.Active) revert TournamentNotActive();
        
        t.state = TournamentState.Completed;
        t.winner = firstPlace;

        uint256 total = t.totalPrizePool;
        uint256 p1 = 0;
        uint256 p2 = 0;
        uint256 p3 = 0;

        if (t.size == 4) {
            p1 = total;
        } else if (t.size == 8) {
            p1 = (total * 75) / 100;
            p2 = (total * 25) / 100;
        } else if (t.size == 16) {
            p1 = (total * 70) / 100;
            p2 = (total * 20) / 100;
            p3 = (total * 10) / 100;
        } else {
            // Fallback (shouldn't happen due to create check)
            p1 = total;
        }

        // Safety check for dust
        uint256 distributed = p1 + p2 + p3;
        if (distributed < total) {
            // Send dust to owner or first place? Let's add to first place to drain contract
            p1 += (total - distributed);
        }

        if (p1 > 0 && firstPlace != address(0)) _pushFunds(t.entryToken, firstPlace, p1);
        if (p2 > 0 && secondPlace != address(0)) _pushFunds(t.entryToken, secondPlace, p2);
        if (p3 > 0 && thirdPlace != address(0)) _pushFunds(t.entryToken, thirdPlace, p3);

        emit TournamentEnded(tournamentId, firstPlace, total);
    }

    function _pushFunds(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            (bool sent, ) = payable(to).call{value: amount}("");
            require(sent, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
