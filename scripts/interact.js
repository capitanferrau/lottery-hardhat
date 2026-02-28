/**
 * Script di interazione con LotteryWithTickets.
 * Prima fai partire `hardhat node` e poi `deploy:local`,
 * poi copia l'indirizzo del contratto qui sotto.
 *
 * Esegui con: npx hardhat run scripts/interact.js --network localhost
 */

const hre = require("hardhat");
const { parseEther, formatEther } = require("viem");

// ⚠️  Inserisci qui l'indirizzo del contratto dopo il deploy
const CONTRACT_ADDRESS = "0x0165878a594ca255338adfa4d48449f69242eb8f";

// ── Utility ──────────────────────────────────────────────────
function sep(title) {
  console.log(`\n${"─".repeat(50)}`);
  if (title) console.log(`  ${title}`);
  console.log(`${"─".repeat(50)}`);
}

async function printStatus(lottery, publicClient) {
  const isOpen      = await lottery.read.isOpen();
  const ticketPrice = await lottery.read.ticketPrice();
  const tickets     = await lottery.read.getTickets();
  const balance     = await publicClient.getBalance({ address: lottery.address });

  console.log(`  Stato lotteria : ${isOpen ? "🟢 Aperta" : "🔴 Chiusa"}`);
  console.log(`  Prezzo biglietto: ${formatEther(ticketPrice)} ETH`);
  console.log(`  Biglietti venduti: ${tickets.length}`);
  console.log(`  Saldo contratto : ${formatEther(balance)} ETH`);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const [manager, player1, player2] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  const lottery = await hre.viem.getContractAt("LotteryWithTickets", CONTRACT_ADDRESS);

  sep("🎰  LOTTERY INTERACTION SCRIPT");
  console.log(`  Manager  : ${manager.account.address}`);
  console.log(`  Player 1 : ${player1.account.address}`);
  console.log(`  Player 2 : ${player2.account.address}`);

  // ── 1. Stato iniziale ──────────────────────────────────────
  sep("1. Stato iniziale");
  await printStatus(lottery, publicClient);

  // ── 2. Cambio prezzo biglietto ─────────────────────────────
  sep("2. Cambio prezzo biglietto");
  console.log("  Il manager cambia il prezzo a 0.05 ETH...");
  let hash = await lottery.write.setTicketPrice([parseEther("0.05")], {
    account: manager.account,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✅ Prezzo aggiornato a 0.05 ETH`);

  console.log("  Il manager riporta il prezzo a 0.01 ETH...");
  hash = await lottery.write.setTicketPrice([parseEther("0.01")], {
    account: manager.account,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✅ Prezzo riportato a 0.01 ETH`);

  // ── 3. Acquisto biglietti ──────────────────────────────────
  sep("3. Acquisto biglietti");
  console.log("  Player1 acquista 2 biglietti (0.02 ETH)...");
  hash = await lottery.write.buyTickets([], {
    account: player1.account,
    value: parseEther("0.02"),
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✅ Tx: ${hash}`);

  console.log("  Player2 acquista 1 biglietto (0.01 ETH)...");
  hash = await lottery.write.buyTickets([], {
    account: player2.account,
    value: parseEther("0.01"),
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✅ Tx: ${hash}`);

  await printStatus(lottery, publicClient);

  // ── 4. Estrazione vincitore ────────────────────────────────
  sep("4. Estrazione vincitore");
  console.log("  Il manager estrae il vincitore...");
  hash = await lottery.write.pickWinner([], { account: manager.account });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const winnerLogs = await publicClient.getContractEvents({
    address: lottery.address,
    abi: lottery.abi,
    eventName: "WinnerSelected",
    fromBlock: receipt.blockNumber,
    toBlock: receipt.blockNumber,
  });

  const { winner, prize } = winnerLogs[0].args;
  console.log(`  🏆 Vincitore : ${winner}`);
  console.log(`  💎 Premio    : ${formatEther(prize)} ETH`);

  await printStatus(lottery, publicClient);

  // ── 5. Ritiro fondi ────────────────────────────────────────
  sep("5. Ritiro fondi");
  const winnerClient = [manager, player1, player2].find(
    (w) => w.account.address.toLowerCase() === winner.toLowerCase()
  );

  const balBefore = await publicClient.getBalance({ address: winner });
  console.log(`  ${winner} sta ritirando...`);

  hash = await lottery.write.withdraw([], { account: winnerClient.account });
  await publicClient.waitForTransactionReceipt({ hash });

  const balAfter = await publicClient.getBalance({ address: winner });
  console.log(`  Balance prima : ${formatEther(balBefore)} ETH`);
  console.log(`  Balance dopo  : ${formatEther(balAfter)} ETH`);
  console.log(`  ✅ Ritiro completato!`);

  // ── 6. Chiusura lotteria ───────────────────────────────────
  sep("6. Chiusura lotteria");
  console.log("  Il manager chiude la lotteria...");
  hash = await lottery.write.closeLottery([], { account: manager.account });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✅ Lotteria chiusa`);

  // Verifica che buyTickets dia revert a lotteria chiusa
  console.log("  Player1 tenta di acquistare a lotteria chiusa...");
  try {
    await lottery.write.buyTickets([], {
      account: player1.account,
      value: parseEther("0.01"),
    });
  } catch (e) {
    console.log(`  🚫 Revert corretto: La lotteria e' chiusa`);
  }

  // ── 7. Riapertura lotteria ─────────────────────────────────
  sep("7. Riapertura lotteria per la prossima edizione");
  console.log("  Il manager riapre la lotteria...");
  hash = await lottery.write.openLottery([], { account: manager.account });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✅ Lotteria riaperta`);

  await printStatus(lottery, publicClient);

  sep("✅  Script completato con successo!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });