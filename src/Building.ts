import * as PIXI from 'pixi.js';
import { CONFIG } from './config';
import { Elevator } from './Elevator';
import { Person, Direction } from './Person';

export class Building extends PIXI.Container {
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
        const currentQueue = this.floorQueues.get(floor);
        if (currentQueue) {
            currentQueue.push(person);
        }

        // Вычисляем позицию в конце очереди
        const queueIndex = (currentQueue?.length ?? 1) - 1;
        const targetQueueX = 20 + CONFIG.ELEVATOR_WIDTH + 10 + queueIndex * (CONFIG.PERSON_SIZE + 5);

        // Человек идет в конец очереди
        await person.moveTo(targetQueueX, CONFIG.WALK_SPEED);
        
        // После достижения позиции, обновляем позиции ОСТАЛЬНЫХ людей в очереди
        this.updateQueuePositions(floor);
    }

    private updateQueuePositions(floor: number) {
        const queue = this.floorQueues.get(floor) || [];
        queue.forEach((p, index) => {
            // ПРОПУСКАЕМ людей, которые сейчас анимируются
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

    private runElevatorLogic() {
        if (this.isLogicRunning) return;
        this.isLogicRunning = true;

        const loop = async () => {
            while (true) {
                let nextStop = this.findNextStop();

                if (nextStop === null && this.elevator.currentFloor === 1 && this.elevator.passengers.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    nextStop = this.findNextStop();
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


    private findNextStop(): number | null {
        const currentFloor = this.elevator.currentFloor;
        const currentDir = this.elevator.direction;

        // Если в лифте есть пассажиры, едим до их целей И собираем людей в пути
        if (this.elevator.passengers.length > 0) {
            const targets = new Set<number>();

            // Добавляем целевые этажи пассажиров
            this.elevator.passengers.forEach(p => targets.add(p.targetFloor));

            // Добавляем ВСЕ этажи, где есть люди, идущие в ту же сторону (если есть место)
            if (this.elevator.spaceLeft > 0) {
                this.floorQueues.forEach((queue, floor) => {
                    const hasPeopleInSameDir = queue.some(p => p.direction === currentDir);
                    if (hasPeopleInSameDir) {
                        targets.add(floor);
                    }
                });
            }

            const targetList = Array.from(targets).sort((a, b) => a - b);

            if (currentDir === Direction.UP) {
                // Едим вверх: ищем ПЕРВЫЙ этаж > currentFloor
                const upperTargets = targetList.filter(f => f > currentFloor);
                if (upperTargets.length > 0) {
                    return upperTargets[0];
                }
                // Если вверху нечего, возвращаемся вниз
                const lowerTargets = targetList.filter(f => f < currentFloor).sort((a, b) => b - a);
                if (lowerTargets.length > 0) {
                    this.elevator.direction = Direction.DOWN;
                    return lowerTargets[0];
                }
            } else if (currentDir === Direction.DOWN) {
                // Едим вниз: ищем ПЕРВЫЙ этаж < currentFloor
                const lowerTargets = targetList.filter(f => f < currentFloor);
                if (lowerTargets.length > 0) {
                    return lowerTargets.sort((a, b) => b - a)[0];
                }
                // Если внизу нечего, но есть место в лифте и люди ниже, продолжаем вниз
                if (this.elevator.spaceLeft > 0) {
                    let floorsWithPeopleBelow: number[] = [];
                    this.floorQueues.forEach((queue, floor) => {
                        if (floor < currentFloor && queue.length > 0) {
                            floorsWithPeopleBelow.push(floor);
                        }
                    });
                    if (floorsWithPeopleBelow.length > 0) {
                        floorsWithPeopleBelow.sort((a, b) => b - a);
                        return floorsWithPeopleBelow[0];
                    }
                }
                // Если внизу тоже нечего, поднимаемся вверх
                const upperTargets = targetList.filter(f => f > currentFloor).sort((a, b) => a - b);
                if (upperTargets.length > 0) {
                    this.elevator.direction = Direction.UP;
                    return upperTargets[0];
                }
            }
        }

        // Если ліфт порожній і есть свободное место, шукаємо поверхи з людьми
        if (this.elevator.spaceLeft > 0) {
            let floorsWithPeople: number[] = [];
            this.floorQueues.forEach((queue, floor) => {
                if (queue.length > 0) floorsWithPeople.push(floor);
            });

            if (floorsWithPeople.length === 0) {
                this.elevator.direction = null;
                return null;
            }

            // Если направление не задано, едим до ближайшего этажа с людьми
            if (currentDir === null) {
                floorsWithPeople.sort((a, b) => Math.abs(a - currentFloor) - Math.abs(b - currentFloor));
                return floorsWithPeople[0];
            }

            // Если направление задано, проверяем наличие людей в этом направлении
            if (currentDir === Direction.UP) {
                const upperFloors = floorsWithPeople.filter(f => f > currentFloor).sort((a, b) => a - b);
                if (upperFloors.length > 0) return upperFloors[0];

                // Если вверху никого, меняем направление и едим вниз
                const lowerFloors = floorsWithPeople.filter(f => f < currentFloor).sort((a, b) => b - a);
                if (lowerFloors.length > 0) {
                    this.elevator.direction = Direction.DOWN;
                    return lowerFloors[0];
                }
            } else if (currentDir === Direction.DOWN) {
                const lowerFloors = floorsWithPeople.filter(f => f < currentFloor).sort((a, b) => b - a);
                if (lowerFloors.length > 0) return lowerFloors[0];

                // Если внизу никого, меняем направление и едим вверх
                const upperFloors = floorsWithPeople.filter(f => f > currentFloor).sort((a, b) => a - b);
                if (upperFloors.length > 0) {
                    this.elevator.direction = Direction.UP;
                    return upperFloors[0];
                }
            }
        }

        return null;
    }

    private async handleFloorStop(floor: number) {
        // Зупинка на 800 мс
        await new Promise(resolve => setTimeout(resolve, CONFIG.ELEVATOR_STOP_TIME));

        // 1. Вивантаження пасажирів
        const leaving = this.elevator.removePassengersToFloor(floor);
        for (const person of leaving) {
            const floorY = (CONFIG.FLOORS - floor) * CONFIG.FLOOR_HEIGHT + 20;
            person.position.set(20 + CONFIG.ELEVATOR_WIDTH + 5, floorY);
            person.walkAway(CONFIG.BUILDING_WIDTH);
        }

        // 2. Визначення напрямку, якщо він ще не визначений
        if (this.elevator.passengers.length === 0) {
            const queue = this.floorQueues.get(floor) || [];
            if (queue.length > 0) {
                this.elevator.direction = queue[0].direction;
            }
        }

        // 3. Завантаження пасажирів, яким по дорозі
        const currentQueue = this.floorQueues.get(floor) || [];
        const boarding: Person[] = [];

        for (let i = 0; i < currentQueue.length; i++) {
            if (this.elevator.passengers.length + boarding.length >= CONFIG.ELEVATOR_CAPACITY) {
                break;
            }

            const person = currentQueue[i];

            // ТОЛЬКО берём людей, которые НЕ анимируются (уже достигли очереди)
            if (!person.isAnimating && person.direction === this.elevator.direction) {
                boarding.push(person);
                currentQueue.splice(i, 1);
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