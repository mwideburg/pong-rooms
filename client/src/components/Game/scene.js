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
import wallSound from "./sounds/wall.mp3"
import paddleSound from "./sounds/paddle.mp3"
import score_mp3 from "./sounds/coin.wav"

import './scene.scss'


const Scene = () => {
    const ref = useRef();
    const { name, room, setName, setRoom } = useContext(MainContext)
    
    const [scene, setScene] = useState(new THREE.Scene())
    const { users, setUsers } = useContext(UsersContext);
    const socket = useContext(SocketContext)
    const history = useHistory()
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [pressedKeys, setPressedKeys] = useState([]);
    const [score, setScore] = useState([0, 0])
    const ALLOWED_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']


    window.onpopstate = e => logout()
    useEffect(() => { if (!name) return history.push('/') }, [history, name])

    useEffect(() => {
        const camera = new THREE.PerspectiveCamera(
            75,
            1.46,
            0.1,
            1000
        );
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

        const gameUpdates = [];
        let gameStart = 0;
        let firstServerTimestamp = 0;

        const listener = new THREE.AudioListener();
        camera.add(listener);

        // create a global audio source
        const wall = new THREE.Audio(listener);
        const paddle = new THREE.Audio(listener);
        const scoreMP3 = new THREE.Audio(listener);

        // load a sound and set it as the Audio object's buffer
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load(wallSound, function (buffer) {
            wall.setBuffer(buffer);
            // wall.setLoop(true);
            wall.setVolume(0.5);

        });
        audioLoader.load(paddleSound, function (buffer) {
            paddle.setBuffer(buffer);
            // paddle.setLoop(true);
            paddle.setVolume(0.5);

        });
        audioLoader.load(score_mp3, function (buffer) {
            scoreMP3.setBuffer(buffer);
            // scoreMP3.setLoop(true);
            scoreMP3.setVolume(0.5);

        });

        addObjects(objects)
        socket.on("update", game => {
           
            if(game === null) return;

            processGameUpdate(game)
        })

        
        
        
        let controls = null;
        socket.on("addPlayer", (player) => {
            
            if(player === null) return;
            if (player.name != name) return;
            
            if(player.selected === '') return;

            controls = new PointerLockControls(objects[player.selected], renderer.domElement);
            scene.add(controls.getObject());
            
        })
        let moveForward = false;
        let moveBackward = false
         
        const me = {
            id: socket.id,
            room: room,
            dir: 0,
           
        }

        
        const onKeyDown = function (event) {

            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    moveForward = true;
                    me.dir = .05
                    break;

                case 'ArrowDown':
                case 'KeyS':
                    moveBackward = true;
                    me.dir = -.05
                    break;
                default:
                    break;
            }
            socket.emit("move", me)
        };
        const onKeyUp = function (event) {

            switch (event.code) {

                case 'ArrowUp':
                case 'KeyW':
                    moveForward = false;
                    me.dir = 0
                    break;

                case 'ArrowDown':
                case 'KeyS':
                    moveBackward = false;
                    me.dir = 0
                default:
                    break;

            }
            socket.emit("move", me)
        };
        if (window) {
            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('keyup', onKeyUp);
        }
        
        function processGameUpdate(update) {
            if (!firstServerTimestamp) {
                firstServerTimestamp = update.t;
                gameStart = Date.now();
            }
            gameUpdates.push(update);

            // Keep only one game update before the current server time
            const base = getBaseUpdate();
            if (base > 0) {
                gameUpdates.splice(0, base);
            }
        }
        function currentServerTime() {
            return firstServerTimestamp + (Date.now() - gameStart) - 50;
        }

        // Returns the index of the base update, the first game update before
        // current server time, or -1 if N/A.
        function getBaseUpdate() {
            const serverTime = currentServerTime();
            for (let i = gameUpdates.length - 1; i >= 0; i--) {
                if (gameUpdates[i].t <= serverTime) {
                    return i;
                }
            }
            return -1;
        }
        function getCurrentState() {
            if (!firstServerTimestamp) {
                return {};
            }

            const base = getBaseUpdate();
            const serverTime = currentServerTime();
            if (base < 0) {
                return gameUpdates[gameUpdates.length - 1];
            } else if (base === gameUpdates.length - 1) {
                return gameUpdates[base];
            } else {
                const baseUpdate = gameUpdates[base];
                const next = gameUpdates[base + 1];
                const r = (serverTime - baseUpdate.t) / (next.t - baseUpdate.t)
                
                return{
                    base: baseUpdate,
                    next: next,
                    r: r
                }
            }
        }
        let last = Date.now()
        let scored = false
        
        const animate = function () {
            requestAnimationFrame(animate);
            let now = Date.now()
            let delta = (now - last) / 1000

          
                
                const { base, next, r } = getCurrentState()
                
                if(base && next){
                    
                        
                        const from = new THREE.Vector3(base.ball.x, base.ball.y, 0)
                        const to = new THREE.Vector3(next.ball.x, next.ball.y, 0)
                        
                        objects["ball"].position.lerpVectors(from, to, r)
                        
                        if(next.play === "wall" || base.play === "wall") wall.play()
                        if (next.play === "paddle" || base.play === "paddle") paddle.play()
                        if (next.play === "scoreSound" || base.play === "scourSound") scoreMP3.play()
                        if(base.player1 && next.player1){
                            
                            objects["player1"].position.lerpVectors(
                                new THREE.Vector3(base.player1.x, base.player1.y, 0),
                                new THREE.Vector3(next.player1.x, next.player1.y, 0),
                                r
                            )
    
                        }
                        if (base.player2 && next.player2){
                           
                            objects["player2"].position.lerpVectors(
                                new THREE.Vector3(base.player2.x, base.player2.y, 0),
                                new THREE.Vector3(next.player2.x, next.player2.y, 0),
                                r
                            )
                        }
                    
                    
                }
                

                renderer.render(scene, camera);
            
            last = now
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

        // setPlayers(newPlayers)
        const listener = new THREE.AudioListener();

        return newPlayers
    }

    const logout = () => {
        setName(''); setRoom('');
        history.push('/')
        history.go(0)
    }

    return (
        <>
            <Flex align="center" flexDirection="column" justifyContent="center" width="100%" height="auto">
                            
                <div ref={ref} className="pongDiv" />

            </Flex>

        </>
    )
}

export default Scene
