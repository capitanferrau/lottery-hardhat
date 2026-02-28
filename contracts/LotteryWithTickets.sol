// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LotteryWithTickets {
    // L'indirizzo del manager (chi deploya il contratto)
    address public manager;

    // Array dei biglietti; ogni biglietto corrisponde all'indirizzo dell'acquirente.
    // Se un utente acquista più biglietti, il suo indirizzo apparirà più volte.
    address[] public tickets;

    // Pull-payment mapping per prevenire DoS su transfer
    mapping(address => uint256) public pendingWithdrawals;

    // Prezzo di un singolo biglietto (0.01 ether)
    uint public ticketPrice = 0.01 ether;

    // Stato della lotteria: aperta o chiusa
    bool public isOpen = true;

    // ── Eventi ───────────────────────────────────────────────
    event WinnerSelected(address indexed winner, uint256 prize);
    event Withdrawal(address indexed user, uint256 amount);
    event LotteryOpened();
    event LotteryClosed();
    event TicketPriceChanged(uint256 oldPrice, uint256 newPrice);

    // Il costruttore imposta il manager al momento del deploy
    constructor() {
        manager = msg.sender;
    }

    // ── Modificatori ─────────────────────────────────────────

    /**
     * @dev Limita alcune funzioni al solo manager.
     */
    modifier restricted() {
        require(msg.sender == manager, "Solo il manager puo' chiamare questa funzione");
        _;
    }

    /**
     * @dev Consente l'azione solo se la lotteria è aperta.
     */
    modifier onlyWhenOpen() {
        require(isOpen, "La lotteria e' chiusa");
        _;
    }

    /**
     * @dev Consente l'azione solo se la lotteria è chiusa.
     */
    modifier onlyWhenClosed() {
        require(!isOpen, "Chiudi la lotteria prima di estrarre il vincitore");
        _;
    }

    // ── Funzioni manager ─────────────────────────────────────

    /**
     * @dev Apre la lotteria.
     */
    function openLottery() public restricted {
        require(!isOpen, "La lotteria e' gia' aperta");
        isOpen = true;
        emit LotteryOpened();
    }

    /**
     * @dev Chiude la lotteria.
     */
    function closeLottery() public restricted {
        require(isOpen, "La lotteria e' gia' chiusa");
        isOpen = false;
        emit LotteryClosed();
    }

    /**
     * @dev Cambia il prezzo del biglietto.
     * Può essere modificato solo quando non ci sono biglietti venduti.
     */
    function setTicketPrice(uint256 newPrice) public restricted {
        require(newPrice > 0, "Il prezzo deve essere maggiore di zero");
        require(tickets.length == 0, "Non puoi cambiare il prezzo con biglietti gia' venduti");
        uint256 oldPrice = ticketPrice;
        ticketPrice = newPrice;
        emit TicketPriceChanged(oldPrice, newPrice);
    }

    /**
     * @dev Funzione per scegliere il vincitore.
     * Solo il manager può chiamarla; seleziona un biglietto a caso, salva l'intero saldo
     * del contratto per il vincitore e resetta l'array dei biglietti per la prossima edizione.
     * La lotteria deve essere CHIUSA per poter estrarre (chiudi prima con closeLottery()).
     */
    function pickWinner() public restricted onlyWhenClosed {
        require(tickets.length > 0, "Non ci sono biglietti acquistati");
        uint index = random() % tickets.length;
        address winner = tickets[index];

        // Reset dei biglietti per una nuova edizione della lotteria
        tickets = new address[](0);

        // Salva il montepremi per poi essere ritirato in modo sicuro
        uint256 prize = address(this).balance;
        pendingWithdrawals[winner] += prize;
        emit WinnerSelected(winner, prize);
    }

    // ── Funzioni pubbliche ───────────────────────────────────

    /**
     * @dev Funzione per acquistare biglietti.
     * L'utente deve inviare un importo maggiore o uguale al prezzo di un biglietto,
     * e l'importo inviato deve essere un multiplo di ticketPrice.
     * La lotteria deve essere aperta per poter acquistare.
     */
    function buyTickets() public payable onlyWhenOpen {
        require(msg.value >= ticketPrice, "Devi inviare almeno il prezzo di un biglietto");
        require(msg.value % ticketPrice == 0, "L'importo inviato deve essere un multiplo del prezzo del biglietto");
        uint numberOfTickets = msg.value / ticketPrice;
        for (uint i = 0; i < numberOfTickets; i++) {
            tickets.push(msg.sender);
        }
    }

    /**
     * @dev Permette al vincitore di ritirare i fondi in modo sicuro (pattern CEI).
     */
    function withdraw() public {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nessun fondo da prelevare");         // Check
        pendingWithdrawals[msg.sender] = 0;                        // Effect

        (bool success, ) = msg.sender.call{value: amount}("");     // Interaction
        require(success, "Ritiro fallito");

        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @dev Funzione per visualizzare i biglietti acquistati.
     */
    function getTickets() public view returns (address[] memory) {
        return tickets;
    }

    // ── Casualità simulata ───────────────────────────────────

    /**
     * @dev Genera un numero pseudo-casuale.
     * ⚠️  NON sicuro in produzione: i miner possono influenzare block.prevrandao
     *     e block.timestamp. Per ambienti reali usare Chainlink VRF.
     */
    function random() private view returns (uint) {
        return uint(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, tickets.length)));
    }

    // ── Fallback ─────────────────────────────────────────────

    receive() external payable {
        revert("Usa buyTickets per mandare ETH");
    }

    fallback() external payable {
        revert();
    }
}
