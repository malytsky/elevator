import * as PIXI from 'pixi.js';
import { CONFIG } from './config';
import { Person, Direction } from './Person';

export class Elevator extends PIXI.Container {
    public currentFloor: number = 1;
    public passengers: Person[] = [];
    public direction: Direction | null = null;
    private graphics: PIXI.Graphics;

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
            .fill(0xFFFFFF)
            .stroke({ color: 0x000000, width: 3 });

        this.graphics
            .moveTo(CONFIG.ELEVATOR_WIDTH / 2, 0)
            .lineTo(CONFIG.ELEVATOR_WIDTH / 2, CONFIG.FLOOR_HEIGHT - 10)
            .stroke({ color: 0x333333, width: 1 });
    }


    public async moveToFloor(floor: number): Promise<void> {
        if (this.currentFloor === floor) {
            return;
        }

        const targetY = (CONFIG.FLOORS - floor) * CONFIG.FLOOR_HEIGHT + 5;
        const startY = this.position.y;
        const distance = Math.abs(this.currentFloor - floor);
        const duration = distance * CONFIG.ELEVATOR_SPEED;

        return new Promise((resolve) => {
            let elapsedTime = 0;

            const animate = (ticker: PIXI.Ticker) => {
                elapsedTime += ticker.deltaMS;
                const progress = Math.min(elapsedTime / duration, 1);

                this.position.y = startY + (targetY - startY) * progress;

                // Обновляем позиции пассажиров каждый кадр, пока лифт движется
                this.updatePassengersPosition();

                if (progress >= 1) {
                    this.position.y = targetY;
                    this.currentFloor = floor;
                    PIXI.Ticker.shared.remove(animate);
                    resolve();
                }
            };

            PIXI.Ticker.shared.add(animate);
        });
    }

    public addPassenger(person: Person): boolean {
        if (this.passengers.length < CONFIG.ELEVATOR_CAPACITY) {
            this.passengers.push(person);
            // НЕ меняем родителя! Пассажир остаётся в waitingArea
            this.updatePassengersPosition();
            return true;
        }
        return false;
    }

    public removePassengersToFloor(floor: number): Person[] {
        const leaving = this.passengers.filter(p => p.targetFloor === floor);
        this.passengers = this.passengers.filter(p => p.targetFloor !== floor);
        // Пассажиры уже в waitingArea, ничего не удаляем
        this.updatePassengersPosition();
        return leaving;
    }

    private updatePassengersPosition() {
        const padding = 5;

        this.passengers.forEach((p, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);

            // располагаем пассажиров, чтобы визуально все поместились в лифте
            const x = padding + col * (CONFIG.PERSON_SIZE + 2);
            const y = padding + row * (CONFIG.PERSON_SIZE + 2);

            // Переводим в мировые координаты лифта
            const worldX = this.position.x + x;
            const worldY = this.position.y + y;

            p.position.set(worldX, worldY);
        });
    }

    public get spaceLeft(): number {
        return CONFIG.ELEVATOR_CAPACITY - this.passengers.length;
    }
}