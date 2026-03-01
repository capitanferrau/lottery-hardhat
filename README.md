# Lottery Hardhat + Viem

Progetto Hardhat per il contratto `LotteryWithTickets.sol`, con script di deploy, interazione e test scritti usando **Viem**.

---

## Struttura

```
lottery-hardhat/
├── contracts/
│   └── LotteryWithTickets.sol     # Il contratto
├── scripts/
│   ├── deploy.js                  # Script di deploy
│   └── interact.js                # Script di interazione completa
├── test/
│   └── LotteryWithTickets.test.js # 36 test con Viem + Chai
├── hardhat.config.js
├── package.json
├── package-lock.json              # Versioni esatte delle dipendenze (non modificare)
├── README.md
└── run.bat                        # Automazione completa con un click (Windows)
```

---

## Come funziona il contratto

Il contratto `LotteryWithTickets` implementa una lotteria on-chain con i seguenti meccanismi:

**Partecipazione** — Chiunque puo acquistare uno o piu biglietti inviando un multiplo di `ticketPrice` (default 0.01 ETH) alla funzione `buyTickets()`. Ogni biglietto corrisponde a una entry nell'array `tickets`, quindi chi compra piu biglietti ha piu probabilita di vincere.

**Estrazione** — Prima di estrarre, il manager deve chiudere la lotteria con `closeLottery()` (impedendo nuovi acquisti). Solo allora puo chiamare `pickWinner()`, che seleziona un indirizzo a caso dall'array dei biglietti usando `keccak256` su `block.prevrandao`, `block.timestamp` e la lunghezza dell'array. Il montepremi viene assegnato al vincitore tramite il pattern **pull-payment** (`pendingWithdrawals`) per prevenire attacchi DoS.

**Ritiro** — Il vincitore chiama `withdraw()` per ricevere i fondi. Il contratto segue il pattern **CEI** (Check-Effect-Interaction) per prevenire attacchi di reentrancy.

**Gestione lotteria** — Il manager puo aprire e chiudere la lotteria (`openLottery` / `closeLottery`). Quando e chiusa non e possibile ne acquistare biglietti ne estrarre il vincitore.

**Prezzo biglietto** — Il manager puo modificare `ticketPrice` con `setTicketPrice()`, ma solo quando non ci sono biglietti venduti.

> Attenzione: La funzione `random()` e pseudo-casuale e non sicura in produzione. Per applicazioni reali usare **Chainlink VRF**.

### Funzioni principali

| Funzione | Chi puo chiamarla | Descrizione |
|---|---|---|
| `buyTickets()` | Chiunque | Acquista biglietti inviando ETH |
| `pickWinner()` | Manager | Estrae il vincitore e assegna il premio |
| `withdraw()` | Chiunque (con fondi pending) | Ritira i fondi vinti |
| `openLottery()` | Manager | Apre la lotteria |
| `closeLottery()` | Manager | Chiude la lotteria |
| `setTicketPrice()` | Manager | Cambia il prezzo del biglietto |
| `getTickets()` | Chiunque | Restituisce l'array dei biglietti |

---

## Prerequisiti

- [Node.js](https://nodejs.org) (versione LTS)

---

## Avvio rapido (Windows)

Il modo piu semplice per eseguire tutto e fare **doppio click** su `run.bat`.

Lo script esegue automaticamente in sequenza:

1. `npm install` — installa le dipendenze
2. `npm run compile` — compila il contratto
3. `npm run coverage` — esegue i test e mostra la copertura del codice
4. Avvia il nodo Hardhat locale in una finestra separata
5. Deploy del contratto e salvataggio automatico dell'indirizzo
6. Esegue lo script di interazione completa

> Su Windows e normale vedere `Assertion failed: UV_HANDLE_CLOSING` — e un bug noto di Node.js/Windows che non influenza i risultati.

---

## Comandi manuali

### Installare le dipendenze
```bash
npm install
```

### Compilare il contratto
```bash
npm run compile
```

### Eseguire i test
```bash
npm test
```

### Verificare la coverage
```bash
npm run coverage
```

---

## Deploy e interazione manuale

### 1 — Avvia il nodo Hardhat locale (Terminale 1)
```bash
npm run node
```
Lascia questo terminale aperto per tutta la sessione.

### 2 — Deploy del contratto (Terminale 2)
```bash
npm run deploy:local
```

### 3 — Configura lo script di interazione
Apri `scripts/interact.js` e incolla l'indirizzo nella variabile:
```js
const CONTRACT_ADDRESS = "0x...indirizzo_dal_deploy";
```

### 4 — Esegui lo script di interazione
```bash
npm run interact
```

Lo script esegue in sequenza:
1. Mostra lo stato iniziale della lotteria
2. Dimostra il cambio del prezzo biglietto
3. Player1 e Player2 acquistano biglietti
4. Il manager chiude la lotteria ed estrae il vincitore
5. Il vincitore ritira i fondi
6. Il manager riapre la lotteria per la prossima edizione

> Ogni volta che riavvii `npm run node`, la blockchain riparte da zero e devi ripetere il deploy.

---