import * as PIXI from 'pixi.js';
import { CONFIG } from './config';
import { Elevator } from './Elevator';
import { Person, Direction } from './Person';

export class Building extends PIXI.Container {
    private floors: PIXI.Graphics[] = [];
    private elevator: Elevator;
    private floorQueues: Map<number, Person[]> = new Map();
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

        for (let i = 1; i <= CONFIG.FLOORS; i++) {
            this.floorQueues.set(i, []);
            this.startSpawning(i);
        }

        this.runElevatorLogic();
        
        // Тестовий рух для перевірки
        setTimeout(async () => {
            console.log("Starting test movement check...");
            // Якщо ліфт все ще на 1 поверсі і немає пасажирів, примусово створюємо пасажира
            if (this.elevator.currentFloor === 1 && this.elevator.passengers.length === 0) {
                console.log("Forcing elevator activity by creating a person at floor 1");
                this.createPerson(1); 
            }
        }, 3000);
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
            
            // Номер поверху зліва від шахти для зручності
            const floorNum = CONFIG.FLOORS - i;
            const text = new PIXI.Text({ text: floorNum.toString(), style: { fontSize: 18, fill: 0x000000 } });
            text.position.set(5, y + 30);
            this.addChild(text);

            // Текст поверху справа
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
            console.error(`Invalid floor for person: ${floor}`);
            return;
        }
        let targetFloor;
        do {
            targetFloor = Math.floor(Math.random() * CONFIG.FLOORS) + 1;
        } while (targetFloor === floor);

        console.log(`Creating person at floor ${floor} going to ${targetFloor}`);
        const person = new Person(floor, targetFloor);
        // Початкова позиція за межами будівлі зправа
        person.position.set(CONFIG.BUILDING_WIDTH - CONFIG.PERSON_SIZE - 20, (CONFIG.FLOORS - floor) * CONFIG.FLOOR_HEIGHT + 20);
        this.waitingArea.addChild(person);

        console.log(`Person at floor ${floor} walking to elevator. Initial X: ${person.x}`);
        
        // Ensure the person is added to the queue even if walk animation fails
        const walkPromise = person.walkToElevator(20 + CONFIG.ELEVATOR_WIDTH);
        const timeoutPromise = new Promise(r => setTimeout(r, CONFIG.WALK_SPEED + 2000));
        
        await Promise.race([walkPromise, timeoutPromise]);
        
        console.log(`Person at floor ${floor} reached elevator queue area`);
        const currentQueue = this.floorQueues.get(floor);
        if (currentQueue && !currentQueue.includes(person)) {
            currentQueue.push(person);
            this.updateQueuePositions(floor);
        }
    }

    private updateQueuePositions(floor: number) {
        const queue = this.floorQueues.get(floor) || [];
        queue.forEach((p, index) => {
            p.x = 20 + CONFIG.ELEVATOR_WIDTH + 10 + index * (CONFIG.PERSON_SIZE + 5);
        });
    }

    private runElevatorLogic() {
        if (this.isLogicRunning) return;
        this.isLogicRunning = true;

        console.log("Elevator logic started");

        const loop = async () => {
            while (true) {
                let nextStop = this.findNextStop();

                if (nextStop === null && this.elevator.currentFloor === 1 && this.elevator.passengers.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    nextStop = this.findNextStop();
                }

                console.log("Elevator logic iteration. Next stop:", nextStop, "Current floor:", this.elevator.currentFloor, "Passengers:", this.elevator.passengers.length);
                if (nextStop !== null) {
                    console.log("Moving to floor:", nextStop);
                    await this.elevator.moveToFloor(nextStop);
                    await this.handleFloorStop(nextStop);
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        };

        // Запускаем асинхронный цикл без await (не блокируем конструктор)
        loop();
    }

    private findNextStop(): number | null {
        const currentFloor = this.elevator.currentFloor;
        const currentDir = this.elevator.direction;

        // 1. Якщо є пасажири, їдемо до найближчого поверху за напрямком
        if (this.elevator.passengers.length > 0) {
            const targets = new Set<number>();
            this.elevator.passengers.forEach(p => targets.add(p.targetFloor));
            
            // Також перевіряємо, чи є на поверхах люди, яким в ту ж сторону
            this.floorQueues.forEach((queue, floor) => {
                const hasPeopleInSameDir = queue.some(p => p.direction === currentDir);
                if (hasPeopleInSameDir) targets.add(floor);
            });

            const targetList = Array.from(targets);

            if (currentDir === Direction.UP) {
                const upperTargets = targetList.filter(f => f > currentFloor).sort((a, b) => a - b);
                if (upperTargets.length > 0) return upperTargets[0];
                // Якщо зверху більше нічого немає, міняємо напрямок на DOWN і шукаємо цілі
                const lowerTargets = targetList.filter(f => f < currentFloor).sort((a, b) => b - a);
                return lowerTargets.length > 0 ? lowerTargets[0] : null;
            } else if (currentDir === Direction.DOWN) {
                const lowerTargets = targetList.filter(f => f < currentFloor).sort((a, b) => b - a);
                if (lowerTargets.length > 0) return lowerTargets[0];
                const upperTargets = targetList.filter(f => f > currentFloor).sort((a, b) => a - b);
                return upperTargets.length > 0 ? upperTargets[0] : null;
            }
        }

        // 2. Якщо ліфт порожній, шукаємо поверхи з людьми
        let floorsWithPeople: number[] = [];
        this.floorQueues.forEach((queue, floor) => {
            if (queue.length > 0) floorsWithPeople.push(floor);
        });

        if (floorsWithPeople.length === 0) {
            console.log("No floors with people found.");
            this.elevator.direction = null; // Скидаємо напрямок, якщо роботи немає
            return null;
        }

        console.log("Floors with people:", floorsWithPeople);

        // Їдемо до найближчого поверху з людьми
        floorsWithPeople.sort((a, b) => Math.abs(a - currentFloor) - Math.abs(b - currentFloor));
        return floorsWithPeople[0];
    }

    private async handleFloorStop(floor: number) {
        // Зупинка на 800 мс
        await new Promise(resolve => setTimeout(resolve, CONFIG.ELEVATOR_STOP_TIME));

        // 1. Вивантаження пасажирів
        const leaving = this.elevator.removePassengersToFloor(floor);
        for (const person of leaving) {
            this.addChild(person);
            person.position.set(20 + CONFIG.ELEVATOR_WIDTH + 5, (CONFIG.FLOORS - floor) * CONFIG.FLOOR_HEIGHT + 20);
            person.walkAway(CONFIG.BUILDING_WIDTH);
        }

        // 2. Визначення напрямку, якщо він ще не визначений
        if (this.elevator.passengers.length === 0) {
            const queue = this.floorQueues.get(floor) || [];
            if (queue.length > 0) {
                // Пріоритет напрямку, який був у ліфта раніше, якщо там ще є люди на інших поверхах
                // Але якщо ліфт порожній на цьому поверсі, беремо напрямок першої людини в черзі
                this.elevator.direction = queue[0].direction;
            } else {
                // Якщо на цьому поверсі нікого немає, напрямок залишається колишнім,
                // поки findNextStop не знайде нову ціль
            }
        }

        // 3. Завантаження пасажирів, яким по дорозі
        const currentQueue = this.floorQueues.get(floor) || [];
        const boarding: Person[] = [];
        
        // Сортуємо чергу, щоб спочатку брати тих, хто прийшов раніше
        for (let i = 0; i < currentQueue.length; i++) {
            if (this.elevator.isFull) break;
            
            const person = currentQueue[i];
            
            // Якщо ліфт порожній і напрямок не заданий, задаємо його по першій людині в черзі
            if (this.elevator.direction === null) {
                this.elevator.direction = person.direction;
            }

            // Беремо тільки тих, кому в ту ж сторону
            if (person.direction === this.elevator.direction) {
                boarding.push(person);
                currentQueue.splice(i, 1);
                i--;
            }
        }

        for (const person of boarding) {
            this.elevator.addPassenger(person);
        }
        
        this.updateQueuePositions(floor);

        if (leaving.length > 0 || boarding.length > 0) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.ELEVATOR_STOP_TIME));
        }
    }
}