import { Person } from './Person';

export class FloorQueueManager {
    private floorQueues: Map<number, Person[]> = new Map();

    constructor(numFloors: number) {
        for (let i = 1; i <= numFloors; i++) {
            this.floorQueues.set(i, []);
        }
    }

    public addPerson(floor: number, person: Person): void {
        const queue = this.floorQueues.get(floor);
        if (queue) {
            queue.push(person);
        }
    }

    public removePerson(floor: number, person: Person): void {
        const queue = this.floorQueues.get(floor);
        if (queue) {
            const index = queue.indexOf(person);
            if (index > -1) {
                queue.splice(index, 1);
            }
        }
    }

    public getQueue(floor: number): Person[] {
        return this.floorQueues.get(floor) || [];
    }

    public getAllQueues(): Map<number, Person[]> {
        return this.floorQueues;
    }
}
