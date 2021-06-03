import ReactDOM from "react-dom";
import React, { useContext, useEffect, useState, useRef } from 'react'
import { 
    Flex, 
    Heading, 
    Text,  
    Button,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton, 
    useDisclosure
} from "@chakra-ui/react"

import { useHistory } from 'react-router-dom'
import { MainContext } from '../../mainContext'
import { SocketContext } from '../../socketContext'
import { UsersContext } from '../../usersContext'
import * as THREE from "three";
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Socket } from "socket.io-client";

import './scene.scss'


const Scene = () => {
    const ref = useRef();
    const { users, games, setUsers, setGames } = useContext(UsersContext)
    const { name, room, game, setName, setRoom, setGame } = useContext(MainContext)
    const [scene, setScene] = useState(new THREE.Scene())
    const [players, setPlayers] = useState({});
    const socket = useContext(SocketContext)
    const[player1Name, setName1] = useState(game.player1)
    const[player2Name, setName2] = useState(game.player2)
    const { isOpen, onOpen, onClose } = useDisclosure();
    const history = useHistory()
    
    window.onpopstate = e => logout()
    useEffect(() => { if (!name) return history.push('/') }, [history, name])
    const [pressedKeys, setPressedKeys] = useState([]);

    const ALLOWED_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
        
    useEffect(() => {
        
        const startButt = games.find(game => game.room === room)
        
        if (startButt && !startButt.status) {
            document.getElementById("start-game").style.display = "block"
        }
   
        let moveForward = false;
        let moveBackward = false;
        let moveLeft = false;
        let moveRight = false;
        let canJump = false;
        let prevTime = performance.now();
        let start;
        const velocity = new THREE.Vector3();
        const randomDir = [-1, -.2, -1.5, -2, 1, 2, 1.5, .5, .7, 1.8]
        var ballDirX = 1, ballDirY = -1, ballSpeed = .1;

        const camera = new THREE.PerspectiveCamera(
            75,
            1.46,
            0.1,
            1000
        );
        let score1 = 0
        let score2 = 0
        let computerSpeed = 7.6
        let dir = 0


        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(850, 500);

        ref.current.appendChild(renderer.domElement);
        camera.position.z = 5;

        makeLine("green", [-5.6, 0, 0], [.1, 7.7, 0])
        makeLine("green", [5.6, 0, 0], [.1, 7.7, 0])

        const leftWall = -5.2
        const rightWall = 5.4
        const topWall = 3.7
        const bottomWall = -3.68
        let objects = createPong();

        socket.on('movePlayers', (positions) => {
            
            
           if(selected != "player2"){
               objects["player2"].position.set(5, positions.player2[1], 0)
           }
           if(selected != "player1"){
               objects["player1"].position.set(...positions.player1)
           }
            
            if(positions.ball === undefined ){
                return
            }
            // if(selected != "player1" ){
                
                let newBall = makeBall(...positions.ball)
                scene.remove(objects["ball"])
                objects["ball"] = newBall

                scene.add(newBall)

                // ballDirY = positions.ballDirY
                // ballDirX = positions.ballDirX
                // ballSpeed = positions.ballSpeed
            // }
            

        })
        let controls = null;
        let selected = null;
        let computer = false;
        socket.on('games', () => {
            if(game.player2Name === "Player 2"){
                computer = true
            }else if (game.player1Name === "Player 1") {
                computer = true
            }
        })
  
        socket.on("playerAdded", user => {
           
            if (game.status || user.selected === "none" ){
                return;
            } 
            if (user.selected === "player1"){
                computer = true
               
            } 
            if (user.selected === "player2") {
                console.log("player 2 computer false")
                computer = false
            }

            if(user.name != name) return;

            selected = user.selected
            controls = new PointerLockControls(objects[user.selected], renderer.domElement);
            scene.add(controls.getObject());
            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('keyup', onKeyUp);
        })

        addObjects(objects)
        
        socket.on("startGame", (game) => {
            
            document.getElementById("start-game").style.display = "none"
            
            start = true;
            
            
            
        })

        socket.on("playerLeft", (user) => {
            if(user.selected === "player2" || user.selected === "player1"){
                computer = true
            }
           
            
        })
        
        socket.on("newScores", game => {
            score1 = game.score[0]
            score2 = game.score[1]
            
            if (score1 === 10 || score2 === 10) {
                
                document.getElementById("start-game").style.display = "block"
                onOpen() 
            }
            
        })
        const onKeyDown = function (event) {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    moveForward = true;
                    break;

                case 'ArrowDown':
                case 'KeyS':
                    moveBackward = true;
                    break;
                default:
                    break;
            }
        };
        socket.on('playAgain', () => {
           
            if(selected === "none"){
               
                return;
            }
            score1 = 0
            score2 = 0
            onClose()
            
            objects["player1"].position.set(-5, 0, 0)
            objects["player2"].position.set(5, 0, 0)
            ballSpeed = .1
            ballDirY = randomDir[Math.floor(Math.random() * randomDir.length)]
           
        })

        const onKeyUp = function (event) {

            switch (event.code) {

                case 'ArrowUp':
                case 'KeyW':
                    moveForward = false;
                    break;

                case 'ArrowDown':
                case 'KeyS':
                    moveBackward = false;
                default:
                    break;

            }

        };
        
        const moveComputer = (player2, ball, delta) => {
            
           
            if(dir > computerSpeed * 2){
                dir = 0
            }
            if (dir < computerSpeed * 2) {
                dir = 0
            }
            if (player2.position.y > ball.position.y){
                
                dir -= .4
            }
            if (player2.position.y < ball.position.y) {
                
                dir += .4
            }

            player2.position.lerp(new THREE.Vector3(player2.position.x, ball.position.y, 0), (computerSpeed * delta))

            const comp = (selected === "player1") ? "player2" : "player1"
            socket.emit("move", { id: socket.id, room: room, computer: true, selected: comp, position: [player2.position.x, player2.position.y, 0], ball: "computer"})
        }

        const collisionCheck = (ball) => {
            const playArr = [objects["player1"], objects["player2"]]
            playArr.forEach(player => {
                // const top = ball.position.distanceTo(player.position)
                const tr = [player.position.x + .05, player.position.y + .55]
                const bl = [player.position.x - .05, player.position.y - .55]
                const distance = ball.position.distanceTo(player.position)
                const ballPos = ball.position
                const number1 = (tr[0] > 0) ? .1 : .3
                const number2 = (tr[0] > 0) ? -.3 : .1
                if (ballPos.x <= tr[0] + number1 && ballPos.x >= tr[0] + number2 && ballPos.y <= tr[1] && ballPos.y >= bl[1]) {

                    ballDirX = -ballDirX;

                    if (ballPos.y > player.position.y && ballPos.y - player.position.y > .2) {
                        if (ballDirY < 0) {
                            ballDirY -= .3;
                        } else {
                            ballDirY += .3;
                        }

                    }
                    if (ballPos.y < player.position.y && player.position.y - ballPos.y > .2) {
                        if (ballDirY < 0) {
                            ballDirY = -.3;
                        } else {
                            ballDirY += .3;
                        }
                        // ballDirY = -ballDirY;

                    }
                    ballSpeed += .149
                }
            })
            if (ballDirY > ballSpeed * 2) {
                ballDirY = ballSpeed * 2;
            }
            else if (ballDirY < -ballSpeed * 2) {
                ballDirY = -ballSpeed * 2;
            }
            // if ball goes off the top side (side of table)
            if (ball.position.y >= topWall) {
                ballDirY = -ballDirY;
            }

            // if ball goes off the bottom side (side of table)
            if (ball.position.y <= bottomWall) {
                ballDirY = -ballDirY;
            }
            if (ball.position.x >= rightWall + .5) {
                
                score1 += 1
                ball.position.set(0, 0, 0)
                ballSpeed = 0

                socket.emit("playerScored", {room: room, player: "player1"})
                if (score1 === 10) {
                    socket.emit("playerWon", { room: room, player: "player2" })
                    start = false
                    onOpen();
                    return;
                }
                
                setTimeout(() => {
                    ballSpeed = .1
                    
                    ballDirY = randomDir[Math.floor(Math.random() * randomDir.length)]
                }, 300)
            }
            
            // if ball goes off the bottom side (side of table)
            if (ball.position.x <= leftWall - .5) {
                ball.position.set(0, 0, 0)
                ballSpeed = 0
                score2 += 1
                socket.emit("playerScored", { room: room, player: "player2" })
                if (score2 === 10) {
                    socket.emit("playerWon", { room: room, player: "player2" })
                    start = false
                    onOpen();
                    return;
                }
                setTimeout(() => {
                    ballSpeed = .1
                    
                    ballDirY = randomDir[Math.floor(Math.random() * randomDir.length)]
                }, 300)
            }

            

            if (ballSpeed > .1) {
                ballSpeed -= .0006
            }
            if (ballSpeed > .2) {
                ballSpeed -= .004
            }
            ball.translateX( ballDirX * ballSpeed)
            ball.translateY( ballDirY * ballSpeed)
            
        }
    
        const animate = function () {
            requestAnimationFrame(animate);
            
            if(controls != null && selected != null && start){
                const time = performance.now();
                const delta = (time - prevTime) / 1000;
                let dir = 0
                if (moveForward) {
                    if (controls.getObject().position.y < topWall - .48) {
                        dir = .12
                    }
                }
                if (moveBackward) {
                    if (controls.getObject().position.y > bottomWall + .475) {
                        dir = -.12
                    }
                }
                
                controls.getObject().position.y += (dir); // new behavior
                
                const play = objects[selected]
                const ball = objects["ball"]
                if (computer === true) {
                    const comp = (selected === "player1") ? "player2" : "player1"
                    moveComputer(objects[comp], ball, delta);
                }
                if (selected === "player1" || computer === true) {
                    
                    collisionCheck(objects["ball"])
                }
                
                if(selected === "player1" || computer === true){
                    socket.emit('move', { position: [play.position.x, play.position.y, play.position.z], selected: selected, id: socket.id, name: name, ballSpeed: ballSpeed, ballDirX: ballDirX, ballDirY: ballDirY, ball: [ball.position.x, ball.position.y, ball.position.z] });
                }else{

                    socket.emit('move', { position: [play.position.x, play.position.y, play.position.z], selected: selected, id: socket.id, name: name});
                }

                prevTime = time;

            }
            
            
            renderer.render(scene, camera);
        };
        
        animate();

        return () => {
            // Callback to cleanup three js, cancel animationFrame, etc
        }
    }, []);
    
    const makeLine = (color, pos, side) => {
        const geometry = new THREE.BoxGeometry(...side);
        const material = new THREE.MeshBasicMaterial({ color: color });
        const line = new THREE.Mesh(geometry, material);
        line.position.set(...pos)
        scene.add(line)
    }
    const addObjects = (objects) => {
        Object.keys(objects).forEach((key) => {
            let player = objects[key]
            scene.add(player)
        })
    }

    const createPong = () => {
        const newPlayers = {}
        var geometry = new THREE.BoxGeometry(.2, 1, 0);
        var sphere = new THREE.BoxGeometry(.2, .2, 0);
        var material = new THREE.MeshBasicMaterial({ color: "white" });

        let play1 = new THREE.Mesh(geometry, material);
        let play2 = new THREE.Mesh(geometry, material);
        let ball = new THREE.Mesh(sphere, material);
        ball.position.set(0, 0, 0)
        play1.position.set(-5, 0, 0);
        play2.position.set(5, 0, 0);
        
        newPlayers["player1"] = play1
        newPlayers["player2"] = play2
        newPlayers["ball"] = ball
        
        setPlayers(newPlayers)
        
        return newPlayers
    }

    const makeBall = (x, y, z) => {
        var sphere = new THREE.BoxGeometry(.2, .2, 0);
        var material = new THREE.MeshBasicMaterial({ color: "white" });
        let ball = new THREE.Mesh(sphere, material);
        ball.position.set(x, y, z)
       return ball
    }
    const resetGame = () => {
        socket.emit('reset-game', room)
        onClose()
        
    }

    const startGame = () => {
        socket.emit("start")
    }
    const logout = () => {
        setName(''); setRoom('');
        history.push('/')
        history.go(0)
    }

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <ModalHeader>
                    </ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <Flex justifyContent="center">
                     {
                            games && games.map(game => {
                                let score1 = game.score[0]
                                let score2 = game.score[1]
                                let winner = (score1 > score2) ? game.player1Name : game.player2Name
                                return (
                                    <div id="score" key={game.room}>
                                        <Text fontSize="2xl">{winner.slice(0, 1).toUpperCase() + winner.slice(1)} WINS!</Text>
                                    </div>
                                )
                            })
                        }
                        </Flex>
                    </ModalBody>

                    <ModalFooter justifyContent="space-around">
                        <Button variantColor="blue" mr={3} onClick={resetGame}>
                            Play Again
                        </Button>
                        <Button variantColor="blue" mr={3} onClick={onClose}>
                            Close
                        </Button>
                        
                    </ModalFooter>
                </ModalContent>
            </Modal>
        <Flex align="center" flexDirection="column" justifyContent="center" width="100%" height="auto">
            <Flex flexDirection="row" justifyContent="space-around" width="100%">
            
                <Text fontSize='4xl' color="blue.300">{room.slice(0, 1).toUpperCase() + room.slice(1)}</Text>
                <a className="log-out" onClick={logout}>Logout</a>
            </Flex>
            
            <Flex justifyContent="center" width="800px" height="60px">
                <Button id="start-game" onClick={() => startGame()}> Start</Button>
            </Flex>
            <Flex justifyContent="space-between" width="800px" height="100%">
                <Text id="player1" fontSize="2xl" color="black" fontWeight='600'>
                    {
                        games && games.map(game => {
                            return (
                                game.player1Name.slice(0, 1).toUpperCase() + game.player1Name.slice(1)
                            )
                        })
                    }
                </Text>
                
                <Text id="player2" fontSize="2xl" color="black" fontWeight='600'>
                    {
                        games && games.map(game => {
                            return (
                                game.player2Name.slice(0, 1).toUpperCase() + game.player2Name.slice(1)
                            )
                        })
                    }
                </Text>
            </Flex>
            {
                games && games.map(game => {
                    let score1 = game.score[0]
                    let score2 = game.score[1]
                    return (
                        <div id="score" key={game.room}>
                        <Text fontSize="2xl">{score1} : {score2}</Text>
                        </div>
                    )
                })
            }
            <div ref={ref} className="pongDiv"/>
            
        </Flex>
       
    </>
    )
}

export default Scene