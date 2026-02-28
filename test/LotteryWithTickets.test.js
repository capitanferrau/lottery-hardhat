const { expect } = require("chai");
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther } = require("viem");

// ─────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────

async function deployLotteryFixture() {
  const [manager, player1, player2] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  const lottery = await hre.viem.deployContract("LotteryWithTickets");
  return { lottery, manager, player1, player2, publicClient };
}

async function lotteryWithTicketsFixture() {
  const base = await deployLotteryFixture();
  const { lottery, player1, player2 } = base;
  await lottery.write.buyTickets([], { account: player1.account, value: parseEther("0.02") });
  await lottery.write.buyTickets([], { account: player2.account, value: parseEther("0.01") });
  return base;
}

async function lotteryClosedFixture() {
  const base = await deployLotteryFixture();
  const { lottery, manager } = base;
  await lottery.write.closeLottery([], { account: manager.account });
  return base;
}

async function lotteryAfterPickFixture() {
  const base = await deployLotteryFixture();
  const { lottery, manager, player1 } = base;
  await lottery.write.buyTickets([], { account: player1.account, value: parseEther("0.01") });
  await lottery.write.closeLottery([], { account: manager.account });
  await lottery.write.pickWinner([], { account: manager.account });
  return base;
}

// ─────────────────────────────────────────────────────────────
// TEST
// ─────────────────────────────────────────────────────────────

describe("LotteryWithTickets", function () {

  // ── Deploy ───────────────────────────────────────────────
  describe("Deploy", function () {
    it("Imposta il manager correttamente", async function () {
      const { lottery, manager } = await loadFixture(deployLotteryFixture);
      const contractManager = await lottery.read.manager();
      expect(contractManager.toLowerCase()).to.equal(manager.account.address.toLowerCase());
    });

    it("Il prezzo del biglietto è 0.01 ETH", async function () {
      const { lottery } = await loadFixture(deployLotteryFixture);
      const price = await lottery.read.ticketPrice();
      expect(price).to.equal(parseEther("0.01"));
    });

    it("L'array biglietti è vuoto inizialmente", async function () {
      const { lottery } = await loadFixture(deployLotteryFixture);
      const tickets = await lottery.read.getTickets();
      expect(tickets.length).to.equal(0);
    });

    it("La lotteria è aperta di default", async function () {
      const { lottery } = await loadFixture(deployLotteryFixture);
      const open = await lottery.read.isOpen();
      expect(open).to.be.true;
    });
  });

  // ── isOpen / openLottery / closeLottery ──────────────────
  describe("Gestione stato lotteria", function () {
    it("Il manager può chiudere la lotteria", async function () {
      const { lottery, manager } = await loadFixture(deployLotteryFixture);
      await lottery.write.closeLottery([], { account: manager.account });
      expect(await lottery.read.isOpen()).to.be.false;
    });

    it("Il manager può riaprire la lotteria", async function () {
      const { lottery, manager } = await loadFixture(lotteryClosedFixture);
      await lottery.write.openLottery([], { account: manager.account });
      expect(await lottery.read.isOpen()).to.be.true;
    });

    it("Solo il manager può chiudere la lotteria", async function () {
      const { lottery, player1 } = await loadFixture(deployLotteryFixture);
      await expect(
        lottery.write.closeLottery([], { account: player1.account })
      ).to.be.rejectedWith("Solo il manager puo' chiamare questa funzione");
    });

    it("Solo il manager può aprire la lotteria", async function () {
      const { lottery, player1 } = await loadFixture(lotteryClosedFixture);
      await expect(
        lottery.write.openLottery([], { account: player1.account })
      ).to.be.rejectedWith("Solo il manager puo' chiamare questa funzione");
    });

    it("Revert se si chiude una lotteria già chiusa", async function () {
      const { lottery, manager } = await loadFixture(lotteryClosedFixture);
      await expect(
        lottery.write.closeLottery([], { account: manager.account })
      ).to.be.rejectedWith("La lotteria e' gia' chiusa");
    });

    it("Revert se si apre una lotteria già aperta", async function () {
      const { lottery, manager } = await loadFixture(deployLotteryFixture);
      await expect(
        lottery.write.openLottery([], { account: manager.account })
      ).to.be.rejectedWith("La lotteria e' gia' aperta");
    });

    it("Emette l'evento LotteryClosed", async function () {
      const { lottery, manager, publicClient } = await loadFixture(deployLotteryFixture);
      const hash = await lottery.write.closeLottery([], { account: manager.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = await publicClient.getContractEvents({
        address: lottery.address, abi: lottery.abi, eventName: "LotteryClosed",
        fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber,
      });
      expect(logs.length).to.equal(1);
    });

    it("Emette l'evento LotteryOpened", async function () {
      const { lottery, manager, publicClient } = await loadFixture(lotteryClosedFixture);
      const hash = await lottery.write.openLottery([], { account: manager.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = await publicClient.getContractEvents({
        address: lottery.address, abi: lottery.abi, eventName: "LotteryOpened",
        fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber,
      });
      expect(logs.length).to.equal(1);
    });
  });

  // ── setTicketPrice ───────────────────────────────────────
  describe("setTicketPrice", function () {
    it("Il manager può cambiare il prezzo se non ci sono biglietti", async function () {
      const { lottery, manager } = await loadFixture(deployLotteryFixture);
      await lottery.write.setTicketPrice([parseEther("0.05")], { account: manager.account });
      expect(await lottery.read.ticketPrice()).to.equal(parseEther("0.05"));
    });

    it("Solo il manager può cambiare il prezzo", async function () {
      const { lottery, player1 } = await loadFixture(deployLotteryFixture);
      await expect(
        lottery.write.setTicketPrice([parseEther("0.05")], { account: player1.account })
      ).to.be.rejectedWith("Solo il manager puo' chiamare questa funzione");
    });

    it("Revert se ci sono biglietti già venduti", async function () {
      const { lottery, manager } = await loadFixture(lotteryWithTicketsFixture);
      await expect(
        lottery.write.setTicketPrice([parseEther("0.05")], { account: manager.account })
      ).to.be.rejectedWith("Non puoi cambiare il prezzo con biglietti gia' venduti");
    });

    it("Revert se il nuovo prezzo è zero", async function () {
      const { lottery, manager } = await loadFixture(deployLotteryFixture);
      await expect(
        lottery.write.setTicketPrice([0n], { account: manager.account })
      ).to.be.rejectedWith("Il prezzo deve essere maggiore di zero");
    });

    it("Emette l'evento TicketPriceChanged", async function () {
      const { lottery, manager, publicClient } = await loadFixture(deployLotteryFixture);
      const hash = await lottery.write.setTicketPrice([parseEther("0.05")], { account: manager.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = await publicClient.getContractEvents({
        address: lottery.address, abi: lottery.abi, eventName: "TicketPriceChanged",
        fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber,
      });
      expect(logs.length).to.equal(1);
      expect(logs[0].args.oldPrice).to.equal(parseEther("0.01"));
      expect(logs[0].args.newPrice).to.equal(parseEther("0.05"));
    });

    it("Il prezzo può essere cambiato dopo l'estrazione (biglietti resettati)", async function () {
      const { lottery, manager } = await loadFixture(lotteryAfterPickFixture);
      await lottery.write.setTicketPrice([parseEther("0.05")], { account: manager.account });
      expect(await lottery.read.ticketPrice()).to.equal(parseEther("0.05"));
    });
  });

  // ── buyTickets ───────────────────────────────────────────
  describe("buyTickets", function () {
    it("Permette di acquistare 1 biglietto", async function () {
      const { lottery, player1 } = await loadFixture(deployLotteryFixture);
      await lottery.write.buyTickets([], { account: player1.account, value: parseEther("0.01") });
      const tickets = await lottery.read.getTickets();
      expect(tickets.length).to.equal(1);
      expect(tickets[0].toLowerCase()).to.equal(player1.account.address.toLowerCase());
    });

    it("Permette di acquistare più biglietti insieme", async function () {
      const { lottery, player1 } = await loadFixture(deployLotteryFixture);
      await lottery.write.buyTickets([], { account: player1.account, value: parseEther("0.03") });
      const tickets = await lottery.read.getTickets();
      expect(tickets.length).to.equal(3);
    });

    it("Registra correttamente l'indirizzo per ogni biglietto", async function () {
      const { lottery, player1, player2 } = await loadFixture(deployLotteryFixture);
      await lottery.write.buyTickets([], { account: player1.account, value: parseEther("0.02") });
      await lottery.write.buyTickets([], { account: player2.account, value: parseEther("0.01") });
      const tickets = await lottery.read.getTickets();
      expect(tickets.length).to.equal(3);
      expect(tickets[0].toLowerCase()).to.equal(player1.account.address.toLowerCase());
      expect(tickets[2].toLowerCase()).to.equal(player2.account.address.toLowerCase());
    });

    it("Revert se la lotteria è chiusa", async function () {
      const { lottery, player1 } = await loadFixture(lotteryClosedFixture);
      await expect(
        lottery.write.buyTickets([], { account: player1.account, value: parseEther("0.01") })
      ).to.be.rejectedWith("La lotteria e' chiusa");
    });

    it("Revert se si invia meno del prezzo minimo", async function () {
      const { lottery, player1 } = await loadFixture(deployLotteryFixture);
      await expect(
        lottery.write.buyTickets([], { account: player1.account, value: parseEther("0.005") })
      ).to.be.rejectedWith("Devi inviare almeno il prezzo di un biglietto");
    });

    it("Revert se l'importo non è multiplo del prezzo", async function () {
      const { lottery, player1 } = await loadFixture(deployLotteryFixture);
      await expect(
        lottery.write.buyTickets([], { account: player1.account, value: parseEther("0.015") })
      ).to.be.rejectedWith("L'importo inviato deve essere un multiplo del prezzo del biglietto");
    });

    it("Revert se si usa receive() direttamente", async function () {
      const { lottery, player1 } = await loadFixture(deployLotteryFixture);
      await expect(
        player1.sendTransaction({ to: lottery.address, value: parseEther("0.01") })
      ).to.be.rejectedWith("Usa buyTickets per mandare ETH");
    });
  });

  // ── pickWinner ───────────────────────────────────────────
  describe("pickWinner", function () {
    it("Solo il manager può estrarre il vincitore", async function () {
      const { lottery, manager, player1 } = await loadFixture(lotteryWithTicketsFixture);
      await lottery.write.closeLottery([], { account: manager.account });
      await expect(
        lottery.write.pickWinner([], { account: player1.account })
      ).to.be.rejectedWith("Solo il manager puo' chiamare questa funzione");
    });

    it("Revert se la lotteria è aperta", async function () {
      const { lottery, manager } = await loadFixture(lotteryWithTicketsFixture);
      await expect(
        lottery.write.pickWinner([], { account: manager.account })
      ).to.be.rejectedWith("Chiudi la lotteria prima di estrarre il vincitore");
    });

    it("Revert se non ci sono biglietti", async function () {
      const { lottery, manager } = await loadFixture(lotteryClosedFixture);
      await expect(
        lottery.write.pickWinner([], { account: manager.account })
      ).to.be.rejectedWith("Non ci sono biglietti acquistati");
    });

    it("Resetta l'array biglietti dopo l'estrazione", async function () {
      const { lottery, manager } = await loadFixture(lotteryWithTicketsFixture);
      await lottery.write.closeLottery([], { account: manager.account });
      await lottery.write.pickWinner([], { account: manager.account });
      const tickets = await lottery.read.getTickets();
      expect(tickets.length).to.equal(0);
    });

    it("Assegna il saldo al vincitore in pendingWithdrawals", async function () {
      const { lottery, manager, publicClient } = await loadFixture(lotteryWithTicketsFixture);
      await lottery.write.closeLottery([], { account: manager.account });
      const contractBalance = await publicClient.getBalance({ address: lottery.address });
      const hash = await lottery.write.pickWinner([], { account: manager.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = await publicClient.getContractEvents({
        address: lottery.address, abi: lottery.abi, eventName: "WinnerSelected",
        fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber,
      });
      expect(logs.length).to.equal(1);
      const { winner, prize } = logs[0].args;
      expect(prize).to.equal(contractBalance);
      const pending = await lottery.read.pendingWithdrawals([winner]);
      expect(pending).to.equal(contractBalance);
    });

    it("Emette l'evento WinnerSelected", async function () {
      const { lottery, manager, publicClient } = await loadFixture(lotteryWithTicketsFixture);
      await lottery.write.closeLottery([], { account: manager.account });
      const hash = await lottery.write.pickWinner([], { account: manager.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = await publicClient.getContractEvents({
        address: lottery.address, abi: lottery.abi, eventName: "WinnerSelected",
        fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber,
      });
      expect(logs.length).to.equal(1);
    });
  });

  // ── withdraw ─────────────────────────────────────────────
  describe("withdraw", function () {
    it("Il vincitore può ritirare i fondi", async function () {
      const { lottery, player1, publicClient } = await loadFixture(lotteryAfterPickFixture);
      const balBefore = await publicClient.getBalance({ address: player1.account.address });
      await lottery.write.withdraw([], { account: player1.account });
      const balAfter = await publicClient.getBalance({ address: player1.account.address });
      expect(balAfter > balBefore).to.be.true;
      const pending = await lottery.read.pendingWithdrawals([player1.account.address]);
      expect(pending).to.equal(0n);
    });

    it("Revert se non ci sono fondi da ritirare", async function () {
      const { lottery, player1 } = await loadFixture(deployLotteryFixture);
      await expect(
        lottery.write.withdraw([], { account: player1.account })
      ).to.be.rejectedWith("Nessun fondo da prelevare");
    });

    it("Emette l'evento Withdrawal", async function () {
      const { lottery, player1, publicClient } = await loadFixture(lotteryAfterPickFixture);
      const hash = await lottery.write.withdraw([], { account: player1.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = await publicClient.getContractEvents({
        address: lottery.address, abi: lottery.abi, eventName: "Withdrawal",
        fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber,
      });
      expect(logs.length).to.equal(1);
    });

    it("Non permette di ritirare due volte", async function () {
      const { lottery, player1 } = await loadFixture(lotteryAfterPickFixture);
      await lottery.write.withdraw([], { account: player1.account });
      await expect(
        lottery.write.withdraw([], { account: player1.account })
      ).to.be.rejectedWith("Nessun fondo da prelevare");
    });
  });

  // ── fallback ─────────────────────────────────────────────
  describe("fallback", function () {
    it("Revert se si chiama una funzione inesistente", async function () {
      const { lottery, player1 } = await loadFixture(deployLotteryFixture);
      await expect(
        player1.sendTransaction({ to: lottery.address, data: "0xdeadbeef", value: 0n })
      ).to.be.rejected;
    });
  });
});