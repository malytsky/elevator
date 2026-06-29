import { Elevator } from './Elevator';
import { Direction } from './Person';
import { FloorQueueManager } from './FloorQueueManager';

export class ElevatorDispatcher {
    constructor(
        private elevator: Elevator,
        private queueManager: FloorQueueManager
    ) {}

    public findNextStop(): number | null {
        const currentFloor = this.elevator.currentFloor;
        const currentDir = this.elevator.direction;
        const floorQueues = this.queueManager.getAllQueues();

        // Если в лифте есть пассажиры, едем до их целей И собираем людей в пути
        if (this.elevator.passengers.length > 0) {
            const targets = new Set<number>();

            // Добавляем целевые этажи пассажиров
            this.elevator.passengers.forEach(p => targets.add(p.targetFloor));

            // Добавляем ВСЕ этажи, где есть люди, идущие в ту же сторону (если есть место)
            if (this.elevator.spaceLeft > 0) {
                floorQueues.forEach((queue, floor) => {
                    const hasPeopleInSameDir = queue.some(p => p.direction === currentDir);
                    if (hasPeopleInSameDir) {
                        targets.add(floor);
                    }
                });
            }

            const targetList = Array.from(targets).sort((a, b) => a - b);

            if (currentDir === Direction.UP) {
                // Едем вверх: ищем ПЕРВЫЙ этаж > currentFloor
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
                // Едем вниз: ищем ПЕРВЫЙ этаж < currentFloor
                const lowerTargets = targetList.filter(f => f < currentFloor);
                if (lowerTargets.length > 0) {
                    return lowerTargets.sort((a, b) => b - a)[0];
                }
                // Если внизу нечего, но есть место в лифте и люди ниже, продолжаем вниз
                if (this.elevator.spaceLeft > 0) {
                    let floorsWithPeopleBelow: number[] = [];
                    floorQueues.forEach((queue, floor) => {
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

        // Если лифт пустой и есть свободное место, ищем этажи с людьми
        if (this.elevator.spaceLeft > 0) {
            let floorsWithPeople: number[] = [];
            floorQueues.forEach((queue, floor) => {
                if (queue.length > 0) floorsWithPeople.push(floor);
            });

            if (floorsWithPeople.length === 0) {
                this.elevator.direction = null;
                return null;
            }

            // Если направление не задано, едем до ближайшего этажа с людьми
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
}
