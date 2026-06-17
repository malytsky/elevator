import * as PIXI from 'pixi.js';
import { CONFIG } from './config';
import { Person, Direction } from './Person';

export class Elevator extends PIXI.Container {
    public currentFloor: number = 1;
    public passengers: Person[] = [];
    public direction: Direction | null = null;
    private graphics: PIXI.Graphics;
    private isMoving: boolean = false;

    constructor() {
        super();
        this.graphics = new PIXI.Graphics();
        this.draw();
        this.addChild(this.graphics);
    }

    private draw() {
        this.graphics.clear();
        this.graphics
            .rect(0, 0, CONFIG.ELEVATOR_WIDTH, CONFIG.FLOOR_HEIGHT - 10)
            .fill(0xFFFFFF)  // Белый цвет вместо серого
            .stroke({ color: 0x000000, width: 3 });

        this.graphics
            .moveTo(CONFIG.ELEVATOR_WIDTH / 2, 0)
            .lineTo(CONFIG.ELEVATOR_WIDTH / 2, CONFIG.FLOOR_HEIGHT - 10)
            .stroke({ color: 0x333333, width: 1 });
    }

    public async moveToFloor(floor: number): Promise<void> {
        console.log(`Elevator: moving from ${this.currentFloor} to ${floor}`);
        if (this.currentFloor === floor) {
            console.log(`Elevator: already at floor ${floor}`);
            return;
        }

        this.isMoving = true;
        const targetY = (CONFIG.FLOORS - floor) * CONFIG.FLOOR_HEIGHT + 5;
        const startY = this.position.y;
        const distance = Math.abs(this.currentFloor - floor);
        const duration = distance * CONFIG.ELEVATOR_SPEED;

        console.log(`Elevator: startY=${startY}, targetY=${targetY}, duration=${duration}ms`);

        return new Promise((resolve) => {
            let elapsedTime = 0;

            const animate = (ticker: PIXI.Ticker) => {
                elapsedTime += ticker.deltaMS;
                const progress = Math.min(elapsedTime / duration, 1);

                this.position.y = startY + (targetY - startY) * progress;

                console.log(`Elevator animating: ${(progress * 100).toFixed(1)}%, Y=${this.position.y.toFixed(1)}`);

                if (progress >= 1) {
                    this.position.y = targetY;
                    this.currentFloor = floor;
                    this.isMoving = false;
                    PIXI.Ticker.shared.remove(animate);
                    console.log(`Elevator: reached floor ${floor}`);
                    resolve();
                }
            };

            PIXI.Ticker.shared.add(animate);
        });
    }

    public addPassenger(person: Person): boolean {
        if (this.passengers.length < CONFIG.ELEVATOR_CAPACITY) {
            this.passengers.push(person);
            this.addChild(person);
            this.updatePassengersPosition();
            return true;
        }
        return false;
    }

    public removePassengersToFloor(floor: number): Person[] {
        const leaving = this.passengers.filter(p => p.targetFloor === floor);
        this.passengers = this.passengers.filter(p => p.targetFloor !== floor);
        leaving.forEach(p => this.removeChild(p));
        this.updatePassengersPosition();
        return leaving;
    }

    private updatePassengersPosition() {
        const elevatorInnerWidth = CONFIG.ELEVATOR_WIDTH - 10; // Отступ от края
        const elevatorInnerHeight = CONFIG.FLOOR_HEIGHT - 20; // Отступ сверху и снизу
        const padding = 5;

        this.passengers.forEach((p, index) => {
            // Располагаем пассажиров в два столбца (по 2 человека в ширину)
            const col = index % 2; // 0 или 1 (левый или правый столбец)
            const row = Math.floor(index / 2); // 0, 1, 2... (ряд сверху)

            // X позиция: распределяем по ширине лифта
            const x = padding + col * (CONFIG.PERSON_SIZE + 2);

            // Y позиция: распределяем по высоте, чтобы все влезли
            const y = padding + row * (CONFIG.PERSON_SIZE + 2);

            p.position.set(x, y);
        });
    }

    public get isFull(): boolean {
        return this.passengers.length >= CONFIG.ELEVATOR_CAPACITY;
    }

    public get spaceLeft(): number {
        return CONFIG.ELEVATOR_CAPACITY - this.passengers.length;
    }
}