// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TournamentManager
 * @dev Manages tournaments with entry fees, escrow, and prize distribution.
 *      Tournament creator sets entry fee, players join and deposit, results are reported,
 *      and prizes are distributed according to predefined percentages (1st, 2nd, 3rd).
 *
 * SECURITY CONSIDERATIONS:
 * - Uses ReentrancyGuard to prevent reentrancy attacks
 * - Uses SafeERC20 for safe token transfers
 * - Entry fees are escrowed until tournament completion
 * - Prize distribution is automatic and deterministic
 * - Only tournament creator can report results
 * - All state transitions are validated
 */
contract TournamentManager is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "TM: Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ============= ENUMS & STRUCTS =============

    enum TournamentStatus {
        Open,        // 0: Accepting players
        Full,        // 1: All slots filled, waiting to start
        InProgress,  // 2: Tournament started
        Completed    // 3: Results finalized, prizes distributed
    }

    enum TournamentSize {
        Four,   // 0: 4 players
        Eight,  // 1: 8 players
        Sixteen // 2: 16 players
    }

    struct Tournament {
        // Core tournament info
        address creator;
        uint256 createdAt;
        TournamentSize size;
        TournamentStatus status;
        
        // Prize configuration
        uint8 firstPlacePct;   // Percentage for 1st place (e.g., 70)
        uint8 secondPlacePct;  // Percentage for 2nd place (e.g., 20)
        uint8 thirdPlacePct;   // Percentage for 3rd place (e.g., 10) - only for 16-player
        
        // Entry fee and token
        uint256 entryFee;      // Amount each player must deposit
        address entryToken;    // Token address (address(0) for native MATIC)
        
        // Players and results
        address[] players;     // Array of players joined
        mapping(address => bool) playerExists; // Quick lookup
        
        // Prize distribution
        address firstPlaceWinner;
        address secondPlaceWinner;
        address thirdPlaceWinner;
        
        // Total prize pool (entryFee * number of players)
        uint256 totalPrizePool;
    }

    // ============= STATE =============

    uint256 public tournamentCount;
    mapping(uint256 => Tournament) public tournaments;
    
    // Track player deposits to prevent accidental duplicates
    mapping(uint256 => mapping(address => bool)) public playerJoined;

    // ============= EVENTS =============

    event TournamentCreated(
        uint256 indexed tournamentId,
        address indexed creator,
        TournamentSize size,
        uint256 entryFee,
        address entryToken
    );

    event PlayerJoined(
        uint256 indexed tournamentId,
        address indexed player,
        uint256 currentPlayers,
        uint256 maxPlayers
    );

    event TournamentStarted(uint256 indexed tournamentId);

    event TournamentCompleted(
        uint256 indexed tournamentId,
        address indexed firstPlace,
        address indexed secondPlace,
        address thirdPlace,
        uint256 firstPrize,
        uint256 secondPrize,
        uint256 thirdPrize
    );

    event PrizeDistributed(
        uint256 indexed tournamentId,
        address indexed recipient,
        uint256 amount,
        string place
    );

    // ============= ERRORS =============

    error TM_InvalidSize();
    error TM_InvalidFeeCombo();
    error TM_InvalidPrizeDistribution();
    error TM_TournamentClosed();
    error TM_AlreadyJoined();
    error TM_NotCreator();
    error TM_InvalidWinner();
    error TM_AlreadyCompleted();
    error TM_NoZeroAddress();
    error TM_DuplicateWinner();
    error TM_InvalidPrizePool();
    error TM_TransferFailed();

    // ============= TOURNAMENT CREATION =============

    /**
     * @notice Creates a new tournament
     * @param size Tournament size (0=4, 1=8, 2=16 players)
     * @param entryFee Amount each player must deposit
     * @param entryToken Token address (address(0) for native MATIC)
     * @param firstPlacePct Percentage for 1st place
     * @param secondPlacePct Percentage for 2nd place
     * @param thirdPlacePct Percentage for 3rd place (0 for 4-8 player tournaments)
     */
    function createTournament(
        TournamentSize size,
        uint256 entryFee,
        address entryToken,
        uint8 firstPlacePct,
        uint8 secondPlacePct,
        uint8 thirdPlacePct
    ) external returns (uint256 tournamentId) {
        // Validate size
        if (uint8(size) > 2) revert TM_InvalidSize();

        // Validate entry fee
        if (entryFee == 0) revert TM_InvalidFeeCombo();

        // Validate percentages based on tournament size
        uint256 maxPlayers = _getSizeValue(size);
        if (maxPlayers == 4 || maxPlayers == 8) {
            // 4 and 8 player tournaments: only 1st and 2nd
            if (firstPlacePct + secondPlacePct != 100) revert TM_InvalidPrizeDistribution();
            if (thirdPlacePct != 0) revert TM_InvalidPrizeDistribution();
        } else {
            // 16 player tournament: 1st, 2nd, and 3rd
            if (firstPlacePct + secondPlacePct + thirdPlacePct != 100) {
                revert TM_InvalidPrizeDistribution();
            }
        }

        tournamentId = ++tournamentCount;

        Tournament storage t = tournaments[tournamentId];
        t.creator = msg.sender;
        t.createdAt = block.timestamp;
        t.size = size;
        t.status = TournamentStatus.Open;
        t.entryFee = entryFee;
        t.entryToken = entryToken;
        t.firstPlacePct = firstPlacePct;
        t.secondPlacePct = secondPlacePct;
        t.thirdPlacePct = thirdPlacePct;
        t.totalPrizePool = 0;

        emit TournamentCreated(tournamentId, msg.sender, size, entryFee, entryToken);
    }

    // ============= TOURNAMENT JOINING =============

    /**
     * @notice Join an existing tournament with entry fee deposit
     * @param tournamentId Tournament to join
     */
    function joinTournament(uint256 tournamentId) external payable nonReentrant {
        Tournament storage t = tournaments[tournamentId];

        // Validate tournament status
        if (t.status != TournamentStatus.Open && t.status != TournamentStatus.Full) {
            revert TM_TournamentClosed();
        }

        // Check if player already joined
        if (playerJoined[tournamentId][msg.sender]) revert TM_AlreadyJoined();

        // Check if tournament is full
        uint256 maxPlayers = _getSizeValue(t.size);
        if (t.players.length >= maxPlayers) revert TM_TournamentClosed();

        // Pull entry fee from player
        _pullFee(t.entryToken, t.entryFee);

        // Add player to tournament
        t.players.push(msg.sender);
        playerJoined[tournamentId][msg.sender] = true;
        t.totalPrizePool += t.entryFee;

        uint256 currentPlayers = t.players.length;

        // If tournament is now full, change status
        if (currentPlayers >= maxPlayers) {
            t.status = TournamentStatus.Full;
        }

        emit PlayerJoined(tournamentId, msg.sender, currentPlayers, maxPlayers);
    }

    // ============= TOURNAMENT MANAGEMENT =============

    /**
     * @notice Start the tournament (only creator can call)
     * @param tournamentId Tournament to start
     */
    function startTournament(uint256 tournamentId) external {
        Tournament storage t = tournaments[tournamentId];

        if (msg.sender != t.creator) revert TM_NotCreator();
        if (t.status != TournamentStatus.Full) revert TM_TournamentClosed();

        t.status = TournamentStatus.InProgress;
        emit TournamentStarted(tournamentId);
    }

    /**
     * @notice Report tournament results and distribute prizes (only creator can call)
     * @param tournamentId Tournament to complete
     * @param firstPlace Address of 1st place winner
     * @param secondPlace Address of 2nd place winner
     * @param thirdPlace Address of 3rd place winner (only for 16-player, use address(0) otherwise)
     */
    function completeTournament(
        uint256 tournamentId,
        address firstPlace,
        address secondPlace,
        address thirdPlace
    ) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];

        // Validate caller
        if (msg.sender != t.creator) revert TM_NotCreator();

        // Validate tournament status
        if (t.status != TournamentStatus.InProgress) revert TM_AlreadyCompleted();

        // Validate winners
        if (firstPlace == address(0) || secondPlace == address(0)) revert TM_NoZeroAddress();
        if (!playerJoined[tournamentId][firstPlace]) revert TM_InvalidWinner();
        if (!playerJoined[tournamentId][secondPlace]) revert TM_InvalidWinner();

        // Check for duplicate winners
        if (firstPlace == secondPlace) revert TM_DuplicateWinner();

        uint256 maxPlayers = _getSizeValue(t.size);

        // Validate 3rd place
        if (maxPlayers == 16) {
            if (thirdPlace == address(0)) revert TM_NoZeroAddress();
            if (!playerJoined[tournamentId][thirdPlace]) revert TM_InvalidWinner();
            if (thirdPlace == firstPlace || thirdPlace == secondPlace) revert TM_DuplicateWinner();
        } else {
            if (thirdPlace != address(0)) revert TM_InvalidWinner();
        }

        // Calculate prizes
        uint256 firstPrize = (t.totalPrizePool * t.firstPlacePct) / 100;
        uint256 secondPrize = (t.totalPrizePool * t.secondPlacePct) / 100;
        uint256 thirdPrize = (t.totalPrizePool * t.thirdPlacePct) / 100;

        // Validate prize pool integrity
        if (firstPrize + secondPrize + thirdPrize > t.totalPrizePool) {
            revert TM_InvalidPrizePool();
        }

        // Update tournament state
        t.status = TournamentStatus.Completed;
        t.firstPlaceWinner = firstPlace;
        t.secondPlaceWinner = secondPlace;
        t.thirdPlaceWinner = thirdPlace;

        // Distribute prizes
        _pushFee(t.entryToken, firstPlace, firstPrize);
        _pushFee(t.entryToken, secondPlace, secondPrize);
        if (thirdPrize > 0) {
            _pushFee(t.entryToken, thirdPlace, thirdPrize);
        }

        emit PrizeDistributed(tournamentId, firstPlace, firstPrize, "1st");
        emit PrizeDistributed(tournamentId, secondPlace, secondPrize, "2nd");
        if (thirdPrize > 0) {
            emit PrizeDistributed(tournamentId, thirdPlace, thirdPrize, "3rd");
        }

        emit TournamentCompleted(
            tournamentId,
            firstPlace,
            secondPlace,
            thirdPlace,
            firstPrize,
            secondPrize,
            thirdPrize
        );
    }

    // ============= INTERNAL HELPERS =============

    /**
     * @dev Convert tournament size enum to number of players
     */
    function _getSizeValue(TournamentSize size) internal pure returns (uint256) {
        if (size == TournamentSize.Four) return 4;
        if (size == TournamentSize.Eight) return 8;
        return 16; // TournamentSize.Sixteen
    }

    /**
     * @dev Pull entry fee from player (handles both native MATIC and ERC20)
     */
    function _pullFee(address token, uint256 amount) internal {
        if (token == address(0)) {
            // Native MATIC
            if (msg.value != amount) revert TM_InvalidFeeCombo();
        } else {
            // ERC20 token
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
    }

    /**
     * @dev Push prize to winner (handles both native MATIC and ERC20)
     */
    function _pushFee(address token, address to, uint256 amount) internal {
        if (amount == 0) return;

        if (token == address(0)) {
            // Native MATIC
            (bool sent, ) = payable(to).call{value: amount}("");
            if (!sent) revert TM_TransferFailed();
        } else {
            // ERC20 token
            IERC20(token).safeTransfer(to, amount);
        }
    }

    // ============= VIEW FUNCTIONS =============

    /**
     * @notice Get tournament info
     */
    function getTournament(uint256 tournamentId) external view returns (
        address creator,
        uint256 createdAt,
        TournamentSize size,
        TournamentStatus status,
        uint256 entryFee,
        address entryToken,
        uint256 playerCount,
        uint256 totalPrizePool
    ) {
        Tournament storage t = tournaments[tournamentId];
        return (
            t.creator,
            t.createdAt,
            t.size,
            t.status,
            t.entryFee,
            t.entryToken,
            t.players.length,
            t.totalPrizePool
        );
    }

    /**
     * @notice Get tournament results
     */
    function getTournamentResults(uint256 tournamentId) external view returns (
        address firstPlace,
        address secondPlace,
        address thirdPlace
    ) {
        Tournament storage t = tournaments[tournamentId];
        return (t.firstPlaceWinner, t.secondPlaceWinner, t.thirdPlaceWinner);
    }

    /**
     * @notice Get list of players in tournament
     */
    function getTournamentPlayers(uint256 tournamentId) external view returns (address[] memory) {
        return tournaments[tournamentId].players;
    }

    /**
     * @notice Check if player joined tournament
     */
    function hasPlayerJoined(uint256 tournamentId, address player) external view returns (bool) {
        return playerJoined[tournamentId][player];
    }

    /**
     * @notice Calculate expected prizes for a tournament
     */
    function calculatePrizes(uint256 tournamentId) external view returns (
        uint256 firstPrize,
        uint256 secondPrize,
        uint256 thirdPrize
    ) {
        Tournament storage t = tournaments[tournamentId];
        firstPrize = (t.totalPrizePool * t.firstPlacePct) / 100;
        secondPrize = (t.totalPrizePool * t.secondPlacePct) / 100;
        thirdPrize = (t.totalPrizePool * t.thirdPlacePct) / 100;
    }

    // ============= ADMIN FUNCTIONS =============

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert TM_NoZeroAddress();
        owner = newOwner;
    }

    // ============= EMERGENCY FUNCTIONS =============

    /**
     * @notice Emergency withdraw (only for unclaimed/problematic tournaments)
     * @dev Should only be used in emergency situations where prize distribution fails
     */
    function emergencyWithdraw(uint256 tournamentId) external onlyOwner nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        if (t.status != TournamentStatus.Completed) revert TM_TournamentClosed();

        uint256 balance = t.totalPrizePool;
        if (balance > 0) {
            t.totalPrizePool = 0;
            _pushFee(t.entryToken, owner, balance);
        }
    }
}
