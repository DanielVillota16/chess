const status_out = document.getElementById('status_out')
const create_game_btn = document.getElementById('create_game_btn')
const game_code = document.getElementById('game_code')
const message_in = document.getElementById('message_in')
const send_btn = document.getElementById('send_message_btn')
const enter_game_btn = document.getElementById('enter_game_btn')
const enter_gamecode = document.getElementById('enter_gamecode')
const messages = document.getElementById('messages')
const whiteSquareGrey = '#a9a9a9'
const blackSquareGrey = '#696969'

var firebaseConfig = {
    apiKey: "AIzaSyC2wrEDLVjqyuehSdyQJjDHQJoE74qo4gI",
    authDomain: "chess-73d61.firebaseapp.com",
    projectId: "chess-73d61",
    storageBucket: "chess-73d61.appspot.com",
    messagingSenderId: "718909950248",
    appId: "1:718909950248:web:36459917950c88b1c9281d"
}
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore()

var game = new Chess()

var playing_white = true

var game_on = false

var current_game_id = ''

var last_msg = {
    msg:'', 
    time: null
}

var config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onMouseoutSquare: onMouseoutSquare,
    onMouseoverSquare: onMouseoverSquare,
    onSnapEnd: onSnapEnd
}

board = Chessboard('board', config)

// HANDLERS

create_game_btn.addEventListener('click', async (e)=>{
    if(!game_on){
        if(current_game_id == ''){
            current_game_id = uuidv4();
            game_code.innerHTML = current_game_id
            //create new game in database
            await db.collection('games').doc(current_game_id).set({
                id:current_game_id,
                last_move: null,
                ready_player1: true,
                ready_player2: false,
                last_msg:last_msg
                })
            onWaitForPlayerResponse()
        }
    }
})

enter_game_btn.addEventListener('click', (e)=>{
    let code = enter_gamecode.value
    if(!game_on){
        db.collection('games').doc(code).get().then((doc)=>{
            if(doc.exists){
                game_on = true
                current_game_id = code
                enter_game()
            }
        })
    }
})

send_btn.addEventListener('click', (e)=>{
    let msg = playing_white? 'player1: '+ message_in.value: 'player2: '+ message_in.value
    let msg_obj = {msg:msg, time: new Date().getTime()}
    if(game_on){
        db.collection('games').doc(current_game_id).update({last_msg:msg_obj})
    } else {
        messages.innerHTML += msg
    }
    message_in.value = ''
})


async function enter_game(){
    await db.collection('games').doc(current_game_id).update({ready_player2:true})
    playing_white = false
    board.orientation('flip')
    updateStatus()
    onWaitForPlayerResponse()
}

function onWaitForPlayerResponse(){
    db.collection('games').doc(current_game_id).onSnapshot((doc)=>{
        let gamedata = doc.data()
        console.log(gamedata)
        if(!game_on){
            if(gamedata.ready_player2){
                game_on = true
                updateStatus()
            }
        } else {
            if(gamedata.last_move){
                game.move(gamedata.last_move)
                board.position(game.fen())
                updateStatus()
            }
            if(last_msg.time != gamedata.last_msg.time) {
                last_msg = gamedata.last_msg
                messages.value += last_msg.msg + '\n'
            }
        }
    })
}

async function unsubscribe(){
    if(current_game_id){
        await db.collection('games').doc(current_game_id).onSnapshot(()=>{
            console.log('listener detatched')
        })   
    }
}

async function finishGame(){
    if(current_game_id){
        await db.collection("games").doc(current_game_id).delete().then(function() {
            console.log("Document successfully deleted!");
        }).catch(function(error) {
            console.error("Error removing document: ", error);
        })
        game_on = false
        playing_white = true
        current_game_id = ''
        game.reset()
        unsubscribe()
    }
}

// GAME LOGIC

function removeGreySquares () {
    $('#board .square-55d63').css('background', '')
}

function greySquare (square) {
    var $square = $('#board .square-' + square)

    var background = whiteSquareGrey
    if ($square.hasClass('black-3c85d')) {
        background = blackSquareGrey
    }

    $square.css('background', background)
}

function onDragStart (source, piece, position, orientation) {
    // do not pick up pieces if the game is over
    if (game.game_over() || !game_on) return false

    if(playing_white && game.turn()=='b' || !playing_white && game.turn()=='w') return false
    // only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false
    }
}

function onDrop (source, target) {
    // see if the move is legal
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    })

    // illegal move
    if (move === null) return 'snapback'
    
    //update lastmove in database
    db.collection('games').doc(current_game_id).update({last_move:move})
    updateStatus()
}

function onMouseoverSquare (square, piece) {
    // get list of possible moves for this square
    var moves = game.moves({
      square: square,
      verbose: true
    })
  
    // exit if there are no moves available for this square
    if (moves.length === 0) return
  
    // highlight the square they moused over
    greySquare(square)
  
    // highlight the possible squares for this piece
    for (var i = 0; i < moves.length; i++) {
        greySquare(moves[i].to)
    }
  }
  

function onSnapEnd () {
    board.position(game.fen())
}

function onMouseoutSquare (square, piece) {
    removeGreySquares()
}

function updateStatus () {
    var status = ''

    var moveColor = 'White'
    if (game.turn() === 'b') {
        moveColor = 'Black'
    }

    // checkmate?
    if (game.in_checkmate()) {
        status = 'Game over, ' + moveColor + ' is in checkmate.'
        finishGame()
    }

    // draw?
    else if (game.in_draw()) {
        status = 'Game over, drawn position'
        finishGame()
    }

    // game still on
    else {
        status = moveColor + ' to move'

        // check?
        if (game.in_check()) {
            status += ', ' + moveColor + ' is in check'
        }
    }
    status_out.innerHTML = 'Estado: ' + status
}

//unsubscribe from listener if tab closed
window.addEventListener('beforeunload', function (e) { 
    e.preventDefault()
    finishGame()
    e.returnValue = ''
})