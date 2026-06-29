import * as PIXI from 'pixi.js';
import { CONFIG } from './config';
import { Elevator } from './Elevator';
import { Person, Direction } from './Person';
import { FloorQueueManager } from './FloorQueueManager';
import { ElevatorDispatcher } from './ElevatorDispatcher';

export class Building extends PIXI.Container {
    private elevator: Elevator;
    private queueManager: FloorQueueManager;
    private dispatcher: ElevatorDispatcher;
    private waitingArea: PIXI.Container;
    private isLogicRunning: boolean = false;

    constructor() {
        super();
        this.waitingArea = new PIXI.Container();
        this.addChild(this.waitingArea);
        this.drawBuilding();
        this.elevator = new Elevator();
        this.elevator.position.set(20, (CONFIG.FLOORS - 1) * CONFIG.FLOOR_HEIGHT + 5);
        this.addChild(this.elevator);

        this.queueManager = new FloorQueueManager(CONFIG.FLOORS);
        this.dispatcher = new ElevatorDispatcher(this.elevator, this.queueManager);

        for (let i = 1; i <= CONFIG.FLOORS; i++) {
            this.startSpawning(i);
        }

        this.runElevatorLogic();
    }

    private drawBuilding() {
        const graphics = new PIXI.Graphics();

        for (let i = 0; i < CONFIG.FLOORS; i++) {
            const y = i * CONFIG.FLOOR_HEIGHT;
            // Підлога
            graphics
                .moveTo(0, y + CONFIG.FLOOR_HEIGHT)
                .lineTo(CONFIG.BUILDING_WIDTH, y + CONFIG.FLOOR_HEIGHT)
                .stroke({ color: 0x000000, width: 2 });

            // Текст поверху справа
            const floorNum = CONFIG.FLOORS - i;
            const textRight = new PIXI.Text({ text: `level ${floorNum}`, style: { fontSize: 14 } });
            textRight.position.set(CONFIG.BUILDING_WIDTH - 70, y + 10);
            this.addChild(textRight);
        }

        graphics
            .rect(10, 0, CONFIG.ELEVATOR_WIDTH + 20, CONFIG.FLOORS * CONFIG.FLOOR_HEIGHT)
            .fill({ color: 0xEEEEEE, alpha: 0.5 })
            .stroke({ color: 0x000000, width: 2 });

        this.addChild(graphics);
    }

    private startSpawning(floor: number) {
        const spawn = () => {
            const delay = Math.random() * (CONFIG.PERSON_SPAWN_INTERVAL[1] - CONFIG.PERSON_SPAWN_INTERVAL[0]) + CONFIG.PERSON_SPAWN_INTERVAL[0];
            setTimeout(() => {
                this.createPerson(floor);
                spawn();
            }, delay);
        };
        spawn();
    }

    private async createPerson(floor: number) {
        if (floor < 1 || floor > CONFIG.FLOORS) {
            return;
        }
        let targetFloor;
        do {
            targetFloor = Math.floor(Math.random() * CONFIG.FLOORS) + 1;
        } while (targetFloor === floor);

        const person = new Person(floor, targetFloor);

        // Начальная позиция за пределами здания (справа)
        person.position.set(CONFIG.BUILDING_WIDTH - CONFIG.PERSON_SIZE - 20, (CONFIG.FLOORS - floor) * CONFIG.FLOOR_HEIGHT + 20);
        this.waitingArea.addChild(person);

        // Добавляем в очередь сразу
        this.queueManager.addPerson(floor, person);
        const currentQueue = this.queueManager.getQueue(floor);

        // Вычисляем позицию в конце очереди, чтобы добавить нового человека в конец очереди на этаже
        const queueIndex = currentQueue.length - 1;
        const targetQueueX = 20 + CONFIG.ELEVATOR_WIDTH + 10 + queueIndex * (CONFIG.PERSON_SIZE + 5);

        // Человек идет в конец очереди
        await person.moveTo(targetQueueX, CONFIG.WALK_SPEED);
        
        // После достижения позиции, обновляем позиции ОСТАЛЬНЫХ людей в очереди
        this.updateQueuePositions(floor);
    }

    private updateQueuePositions(floor: number) {
        const queue = this.queueManager.getQueue(floor);
        queue.forEach((p, index) => {
            // скипаем людей, которые сейчас анимируются
            if (p.isAnimating) {
                return;
            }

            const targetX = 20 + CONFIG.ELEVATOR_WIDTH + 10 + index * (CONFIG.PERSON_SIZE + 5);

            // Анимируем сдвиг очереди
            const startX = p.x;
            const duration = 500; // 500 мс на сдвиг
            let elapsedTime = 0;

            const animate = (ticker: PIXI.Ticker) => {
                elapsedTime += ticker.deltaMS;
                const progress = Math.min(elapsedTime / duration, 1);

                p.position.x = startX + (targetX - startX) * progress;

                if (progress >= 1) {
                    p.position.x = targetX;
                    PIXI.Ticker.shared.remove(animate);
                }
            };

            PIXI.Ticker.shared.add(animate);
        });
    }

    private runElevatorLogic(): void {
        if (this.isLogicRunning) return;
        this.isLogicRunning = true;

        const loop = async () => {
            // @ts-ignore - бесконечный цикл для elevator logic
            while (true) {
                let nextStop = this.dispatcher.findNextStop();

                if (nextStop === null && this.elevator.currentFloor === 1 && this.elevator.passengers.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    nextStop = this.dispatcher.findNextStop();
                }

                if (nextStop !== null) {
                    await this.elevator.moveToFloor(nextStop);
                    await this.handleFloorStop(nextStop);
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        };

        loop();
    }


    private async handleFloorStop(floor: number) {
        // Останавливаем лифт на 800 мс
        await new Promise(resolve => setTimeout(resolve, CONFIG.ELEVATOR_STOP_TIME));

        // 1. Выгрфзка пассажиров
        const leaving = this.elevator.removePassengersToFloor(floor);
        for (const person of leaving) {
            const floorY = (CONFIG.FLOORS - floor) * CONFIG.FLOOR_HEIGHT + 20;
            person.position.set(20 + CONFIG.ELEVATOR_WIDTH + 5, floorY);
            person.walkAway(CONFIG.BUILDING_WIDTH);
        }

        // 2. Определение направления движения
        if (this.elevator.passengers.length === 0) {
            const queue = this.queueManager.getQueue(floor);
            if (queue.length > 0) {
                this.elevator.direction = queue[0].direction;
            }
        }

        // 3. загрузка людей, которым по дороге
        const currentQueue = this.queueManager.getQueue(floor);
        const boarding: Person[] = [];

        for (let i = 0; i < currentQueue.length; i++) {
            if (this.elevator.passengers.length + boarding.length >= CONFIG.ELEVATOR_CAPACITY) {
                break;
            }

            const person = currentQueue[i];

            // ТОЛЬКО берём людей, которые НЕ анимируются (уже достигли очереди, иначе будут дергания)
            if (!person.isAnimating && person.direction === this.elevator.direction) {
                boarding.push(person);
                this.queueManager.removePerson(floor, person);
                i--;
            }
        }

        // Обновляем позиции оставшихся людей в очереди
        this.updateQueuePositions(floor);

        // Добавляем людей в лифт
        for (const person of boarding) {
            // Сохраняем мировую позицию
            const globalPos = this.waitingArea.toGlobal(person.position);

            // Удаляем из waitingArea
            this.waitingArea.removeChild(person);

            // Добавляем в Building (над лифтом в Z-order)
            this.addChild(person);

            // Восстанавливаем позицию в новой системе координат
            person.position.set(globalPos.x, globalPos.y);

            // Добавляем в логический список лифта
            this.elevator.addPassenger(person);
        }

        if (leaving.length > 0 || boarding.length > 0) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.ELEVATOR_STOP_TIME));
        }
    }
}