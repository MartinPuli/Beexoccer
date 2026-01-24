import { expect } from "chai";
import hre from "hardhat";
import { TournamentManager } from "../typechain-types";

describe("TournamentManager", function () {
  let tournamentManager: TournamentManager;
  let owner: any;
  let creator: any;
  let player1: any;
  let player2: any;
  let player3: any;
  let player4: any;

  beforeEach(async function () {
    [owner, creator, player1, player2, player3, player4] = await hre.ethers.getSigners();

    const TournamentManagerFactory = await hre.ethers.getContractFactory("TournamentManager");
    tournamentManager = await TournamentManagerFactory.deploy();
    await tournamentManager.waitForDeployment();
  });

  describe("Tournament Creation", function () {
    it("Should create a 4-player tournament with valid parameters", async function () {
      const entryFee = hre.ethers.parseEther("0.01"); // 0.01 MATIC
      const firstPlacePct = 75;
      const secondPlacePct = 25;
      const thirdPlacePct = 0;

      const tx = await tournamentManager.connect(creator).createTournament(
        0, // TournamentSize.Four
        entryFee,
        hre.ethers.ZeroAddress, // native MATIC
        firstPlacePct,
        secondPlacePct,
        thirdPlacePct
      );

      await expect(tx).to.emit(tournamentManager, "TournamentCreated");
      
      const tournament = await tournamentManager.getTournament(1);
      expect(tournament.creator).to.equal(creator.address);
      expect(tournament.entryFee).to.equal(entryFee);
      expect(tournament.status).to.equal(0); // Open
    });

    it("Should reject invalid prize percentages", async function () {
      const entryFee = hre.ethers.parseEther("0.01");

      // 75% + 25% = 100% (valid) but wrong allocation test
      await expect(
        tournamentManager.connect(creator).createTournament(
          0,
          entryFee,
          hre.ethers.ZeroAddress,
          50, // Invalid: 50 + 25 ≠ 100
          25,
          0
        )
      ).to.be.revertedWithCustomError(tournamentManager, "TM_InvalidPrizeDistribution");
    });

    it("Should reject zero entry fee", async function () {
      await expect(
        tournamentManager.connect(creator).createTournament(
          0,
          0, // Zero fee
          hre.ethers.ZeroAddress,
          75,
          25,
          0
        )
      ).to.be.revertedWithCustomError(tournamentManager, "TM_InvalidFeeCombo");
    });
  });

  describe("Tournament Joining", function () {
    let entryFee: any;

    beforeEach(async function () {
      entryFee = hre.ethers.parseEther("0.1");
      await tournamentManager.connect(creator).createTournament(
        0, // 4-player
        entryFee,
        hre.ethers.ZeroAddress,
        75,
        25,
        0
      );
    });

    it("Should allow players to join with correct fee", async function () {
      const tx = await tournamentManager
        .connect(player1)
        .joinTournament(1, { value: entryFee });

      await expect(tx).to.emit(tournamentManager, "PlayerJoined");

      const isJoined = await tournamentManager.hasPlayerJoined(1, player1.address);
      expect(isJoined).to.be.true;

      const tournament = await tournamentManager.getTournament(1);
      expect(tournament.playerCount).to.equal(1);
      expect(tournament.totalPrizePool).to.equal(entryFee);
    });

    it("Should reject player with incorrect fee", async function () {
      await expect(
        tournamentManager
          .connect(player1)
          .joinTournament(1, { value: hre.ethers.parseEther("0.05") })
      ).to.be.revertedWithCustomError(tournamentManager, "TM_InvalidFeeCombo");
    });

    it("Should reject duplicate join", async function () {
      await tournamentManager
        .connect(player1)
        .joinTournament(1, { value: entryFee });

      await expect(
        tournamentManager
          .connect(player1)
          .joinTournament(1, { value: entryFee })
      ).to.be.revertedWithCustomError(tournamentManager, "TM_AlreadyJoined");
    });

    it("Should fill 4-player tournament after 4 joins", async function () {
      await tournamentManager
        .connect(player1)
        .joinTournament(1, { value: entryFee });
      await tournamentManager
        .connect(player2)
        .joinTournament(1, { value: entryFee });
      await tournamentManager
        .connect(player3)
        .joinTournament(1, { value: entryFee });
      await tournamentManager
        .connect(player4)
        .joinTournament(1, { value: entryFee });

      let tournament = await tournamentManager.getTournament(1);
      expect(tournament.status).to.equal(1); // Full
      expect(tournament.totalPrizePool).to.equal(entryFee * 4n);

      // Should reject 5th join
      await expect(
        tournamentManager
          .connect(owner)
          .joinTournament(1, { value: entryFee })
      ).to.be.revertedWithCustomError(tournamentManager, "TM_TournamentClosed");
    });
  });

  describe("Tournament Completion", function () {
    let entryFee: any;

    beforeEach(async function () {
      entryFee = hre.ethers.parseEther("1.0");
      await tournamentManager.connect(creator).createTournament(
        0, // 4-player
        entryFee,
        hre.ethers.ZeroAddress,
        75,
        25,
        0
      );

      // 4 players join
      await tournamentManager
        .connect(player1)
        .joinTournament(1, { value: entryFee });
      await tournamentManager
        .connect(player2)
        .joinTournament(1, { value: entryFee });
      await tournamentManager
        .connect(player3)
        .joinTournament(1, { value: entryFee });
      await tournamentManager
        .connect(player4)
        .joinTournament(1, { value: entryFee });

      // Start tournament
      await tournamentManager.connect(creator).startTournament(1);
    });

    it("Should complete tournament and distribute prizes", async function () {
      const totalPool = entryFee * 4n;
      const firstPrize = (totalPool * 75n) / 100n; // 3 MATIC
      const secondPrize = (totalPool * 25n) / 100n; // 1 MATIC

      const player1BalanceBefore = await hre.ethers.provider.getBalance(player1.address);
      const player2BalanceBefore = await hre.ethers.provider.getBalance(player2.address);

      await tournamentManager.connect(creator).completeTournament(
        1,
        player1.address,
        player2.address,
        hre.ethers.ZeroAddress
      );

      const player1BalanceAfter = await hre.ethers.provider.getBalance(player1.address);
      const player2BalanceAfter = await hre.ethers.provider.getBalance(player2.address);

      expect(player1BalanceAfter).to.equal(player1BalanceBefore + firstPrize);
      expect(player2BalanceAfter).to.equal(player2BalanceBefore + secondPrize);

      const results = await tournamentManager.getTournamentResults(1);
      expect(results.firstPlace).to.equal(player1.address);
      expect(results.secondPlace).to.equal(player2.address);

      const tournament = await tournamentManager.getTournament(1);
      expect(tournament.status).to.equal(3); // Completed
    });

    it("Should reject completion from non-creator", async function () {
      await expect(
        tournamentManager.connect(player1).completeTournament(
          1,
          player1.address,
          player2.address,
          hre.ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(tournamentManager, "TM_NotCreator");
    });

    it("Should reject duplicate winners", async function () {
      await expect(
        tournamentManager.connect(creator).completeTournament(
          1,
          player1.address,
          player1.address, // Same as first place
          hre.ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(tournamentManager, "TM_DuplicateWinner");
    });

    it("Should reject non-participant as winner", async function () {
      await expect(
        tournamentManager.connect(creator).completeTournament(
          1,
          owner.address, // Not a participant
          player2.address,
          hre.ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(tournamentManager, "TM_InvalidWinner");
    });
  });

  describe("16-Player Tournament", function () {
    let entryFee: any;
    const players: any[] = [];

    beforeEach(async function () {
      const signers = await hre.ethers.getSigners();
      for (let i = 0; i < 16; i++) {
        players.push(signers[i]);
      }

      entryFee = hre.ethers.parseEther("0.5");
      await tournamentManager.connect(players[0]).createTournament(
        2, // TournamentSize.Sixteen
        entryFee,
        hre.ethers.ZeroAddress,
        70, // 1st: 70%
        20, // 2nd: 20%
        10  // 3rd: 10%
      );

      // All 16 players join
      for (let i = 0; i < 16; i++) {
        await tournamentManager
          .connect(players[i])
          .joinTournament(1, { value: entryFee });
      }

      // Start tournament
      await tournamentManager.connect(players[0]).startTournament(1);
    });

    it("Should distribute 3 prizes for 16-player tournament", async function () {
      const totalPool = entryFee * 16n;
      const firstPrize = (totalPool * 70n) / 100n;
      const secondPrize = (totalPool * 20n) / 100n;
      const thirdPrize = (totalPool * 10n) / 100n;

      const tx = await tournamentManager.connect(players[0]).completeTournament(
        1,
        players[1].address,
        players[2].address,
        players[3].address
      );

      await expect(tx).to.emit(tournamentManager, "TournamentCompleted");

      const results = await tournamentManager.getTournamentResults(1);
      expect(results.firstPlace).to.equal(players[1].address);
      expect(results.secondPlace).to.equal(players[2].address);
      expect(results.thirdPlace).to.equal(players[3].address);

      const [first, second, third] = await tournamentManager.calculatePrizes(1);
      expect(first).to.equal(firstPrize);
      expect(second).to.equal(secondPrize);
      expect(third).to.equal(thirdPrize);
    });

    it("Should reject if 3rd place is zero address", async function () {
      await expect(
        tournamentManager.connect(players[0]).completeTournament(
          1,
          players[1].address,
          players[2].address,
          hre.ethers.ZeroAddress // Invalid for 16-player
        )
      ).to.be.revertedWithCustomError(tournamentManager, "TM_NoZeroAddress");
    });
  });
});
