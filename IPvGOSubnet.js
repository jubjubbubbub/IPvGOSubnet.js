/** @param {NS} ns **/
export async function main(ns) {
    const maxRetries = 3;
    const maxLoops = 500;
    let loopCount = 0;

    while (loopCount < maxLoops) {
        ns.tprint(`Starting loop ${loopCount + 1} of ${maxLoops}`);
        let boardInitialized = false;

        for (let i = 0; i < maxRetries; i++) {
            ns.tprint(`Initializing board. Attempt ${i + 1} of ${maxRetries}`);
            boardInitialized = await initializeBoard(ns);
            if (boardInitialized) {
                ns.tprint("Board successfully initialized.");
                break;
            }
            ns.tprint("Board initialization failed. Retrying...");
            await ns.sleep(1000); // Wait before retrying to avoid rapid looping
        }

        if (!boardInitialized) {
            ns.tprint("Critical Error: Unable to initialize board after multiple attempts.");
            return; // Exit if the board cannot be initialized
        }

        while (true) {
            let result, x, y;
            let board = ns.go.getBoardState();
            let validMoves = ns.go.analysis.getValidMoves();

            if (!validMoves || validMoves.length === 0 || !Array.isArray(validMoves[0])) {
                ns.tprint("Error: validMoves is undefined or not properly initialized. Retrying...");
                await ns.sleep(1000); // Adding sleep to prevent rapid looping
                continue;
            }

            ns.tprint("Board and valid moves successfully initialized.");
            
            // Main game loop
            do {
                // Get the best move based on analysis
                const bestMove = getBestMove(board, validMoves, ns);

                if (!bestMove || bestMove.length < 2) {
                    ns.tprint("Error: Could not determine a valid move. Retrying...");
                    await ns.sleep(1000); // Wait before retrying to avoid rapid looping
                    break;
                }

                x = bestMove[0];
                y = bestMove[1];

                if (x === undefined || y === undefined) {
                    // Check if the game is over before passing the turn
                    result = await ns.go.passTurn();
                } else {
                    // Play the selected move
                    result = await ns.go.makeMove(x, y);
                }

                // Check the game state
                if (result?.type === "gameOver") {
                    break;
                }

                // Log opponent's next move, once it happens
                await ns.go.opponentNextTurn();

                await ns.sleep(200);

                // Re-fetch the board and valid moves
                board = ns.go.getBoardState();
                validMoves = ns.go.analysis.getValidMoves();

            } while (result?.type !== "gameOver");

            // Reset the board and prepare for a new game only if the previous game was completed
            if (result?.type === "gameOver") {
                await ns.go.resetBoardState("Illuminati", 13); // Set opponent faction to Illuminati (Hard AI) and board size to 13x13
                ns.tprint("Board has been reset. Starting a new game...");
                await ns.sleep(1000); // Adding sleep to prevent high CPU usage
                break; // Exit the inner loop to restart the outer loop
            }
        }

        loopCount++;
    }

    ns.tprint("Completed 500 loops. Restarting...");
    ns.spawn(ns.getScriptName());
}

// Function to initialize the board
async function initializeBoard(ns) {
    ns.tprint("Attempting to initialize the board...");
    await ns.go.resetBoardState("Illuminati", 13); // Set opponent faction to Illuminati (Hard AI) and board size to 13x13
    await ns.sleep(1000); // Adding sleep to prevent high CPU usage
    
    let board = ns.go.getBoardState();
    ns.tprint("Debug: Board State after reset: " + JSON.stringify(board));
    if (!board || board.length === 0 || !Array.isArray(board[0])) {
        ns.tprint("Error: Board is still not properly initialized.");
        return false;
    }

    // Additional check for valid board state
    if (!isValidBoardState(board)) {
        ns.tprint("Error: Board does not meet the expected conditions.");
        return false;
    }

    ns.tprint("Board initialized: " + JSON.stringify(board));
    return true;
}

// Function to check if the board state is valid
const isValidBoardState = (board) => {
    // Add your own logic to validate the board state
    // For example, check if the board contains a specific pattern or elements
    return board.flat().includes("O") && board.flat().includes("X"); // Placeholder: Check for presence of both players' pieces
}

// Function to get the best move based on analysis
const getBestMove = (board, validMoves, ns) => {
    const moveOptions = [];
    const size = board.length;

    // Consider different strategies to determine the best move
    const strategies = [
        detectCaptureMoves(board, validMoves, ns),
        detectExpansionMoves(board, validMoves),
        detectDefensiveMoves(board, validMoves, ns),
        getRandomMove(board, validMoves)
    ];

    // Choose the first valid move from the prioritized strategies
    for (const strategy of strategies) {
        if (strategy.length > 0) {
            return strategy[Math.floor(Math.random() * strategy.length)];
        }
    }

    // Default to passing the turn if no valid moves are found
    return [undefined, undefined];
};

// Function to get a random valid move
const getRandomMove = (board, validMoves) => {
    const moveOptions = [];
    const size = board.length;

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            if (validMoves[x]?.[y]) { // Added optional chaining
                moveOptions.push([x, y]);
            }
        }
    }

    return moveOptions[Math.floor(Math.random() * moveOptions.length)] || [undefined, undefined];
};

// Detect moves to capture the opponent's routers
const detectCaptureMoves = (board, validMoves, ns) => {
    const captureMoves = [];
    const size = board.length;

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            if (validMoves[x]?.[y] && isCaptureMove(board, x, y, ns)) { // Added optional chaining
                captureMoves.push([x, y]);
            }
        }
    }

    return captureMoves;
};

// Check if a move is a capture move
const isCaptureMove = (board, x, y, ns) => {
    const opponent = 'O';
    return (
        (board[x - 1]?.[y] === opponent && ns.go.analysis.getLiberties(x - 1, y) === 1) ||
        (board[x + 1]?.[y] === opponent && ns.go.analysis.getLiberties(x + 1, y) === 1) ||
        (board[x]?.[y - 1] === opponent && ns.go.analysis.getLiberties(x, y - 1) === 1) ||
        (board[x]?.[y + 1] === opponent && ns.go.analysis.getLiberties(x, y + 1) === 1)
    );
};

// Detect expansion moves
const detectExpansionMoves = (board, validMoves) => {
    const expansionMoves = [];
    const size = board.length;

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            if (validMoves[x]?.[y] && (x % 2 === 1 || y % 2 === 1) && isAdjacentToOurPieces(board, x, y)) { // Added optional chaining
                expansionMoves.push([x, y]);
            }
        }
    }

    return expansionMoves;
};

// Check if a move is adjacent to our pieces
const isAdjacentToOurPieces = (board, x, y) => {
    const ourPiece = 'X';
    return (
        board[x - 1]?.[y] === ourPiece ||
        board[x + 1]?.[y] === ourPiece ||
        board[x]?.[y - 1] === ourPiece ||
        board[x]?.[y + 1] === ourPiece
    );
};

// Detect moves to defend a threatened network
const detectDefensiveMoves = (board, validMoves, ns) => {
    const defensiveMoves = [];
    const size = board.length;

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            if (validMoves[x]?.[y] && isDefensiveMove )board, x, y}}}
