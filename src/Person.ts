import * as PIXI from 'pixi.js';
import { CONFIG } from './config';

export enum Direction {
    UP,
    DOWN
}

export class Person extends PIXI.Container {
    public targetFloor: number;
    public currentFloor: number;
    public direction: Direction;
    private graphics: PIXI.Graphics;
    private text: PIXI.Text;
    private activeAnimation: ((ticker: PIXI.Ticker) => void) | null = null;
    public isInElevator: boolean = false;
    public elevatorRef: any = null;
    public isAnimating: boolean = false;

    constructor(currentFloor: number, targetFloor: number) {
        super();
        this.currentFloor = currentFloor;
        this.targetFloor = targetFloor;
        this.direction = targetFloor > currentFloor ? Direction.UP : Direction.DOWN;

        this.graphics = new PIXI.Graphics();
        const color = this.direction === Direction.UP ? 0x0000FF : 0x00FF00;

        this.graphics
            .rect(0, 0, CONFIG.PERSON_SIZE, CONFIG.PERSON_SIZE)
            .fill({ color: 0xFFFFFF, alpha: 0.5 })
            .stroke({ color, width: 2 });

        this.text = new PIXI.Text({
            text: this.targetFloor.toString(),
            style: {
                fontSize: 16,
                fill: color,
                fontWeight: 'bold'
            }
        });
        this.text.anchor.set(0.5);
        this.text.position.set(CONFIG.PERSON_SIZE / 2, CONFIG.PERSON_SIZE / 2);

        this.addChild(this.graphics);
        this.addChild(this.text);
    }

    public walkToElevator(elevatorX: number): Promise<void> {
        console.log(`Person at floor ${this.currentFloor}: starting walk to elevator`);
        this.isAnimating = true;
        return new Promise((resolve) => {
            const targetX = elevatorX + CONFIG.ELEVATOR_WIDTH / 2;
            const duration = CONFIG.WALK_SPEED;
            let elapsedTime = 0;
            const startX = this.x;

            const animate = (ticker: PIXI.Ticker) => {
                elapsedTime += ticker.deltaMS;
                const progress = Math.min(elapsedTime / duration, 1);

                this.position.x = startX + (targetX - startX) * progress;

                if (progress >= 1) {
                    this.position.x = targetX;
                    PIXI.Ticker.shared.remove(animate);
                    this.activeAnimation = null;
                    this.isAnimating = false;
                    console.log(`Person at floor ${this.currentFloor}: reached elevator`);
                    resolve();
                }
            };

            if (this.activeAnimation) {
                PIXI.Ticker.shared.remove(this.activeAnimation);
            }
            this.activeAnimation = animate;
            PIXI.Ticker.shared.add(animate);
        });
    }

    public walkAway(targetX: number): Promise<void> {
        return new Promise((resolve) => {
            const startX = this.x;
            const duration = CONFIG.WALK_SPEED;
            let elapsedTime = 0;

            const animate = (ticker: PIXI.Ticker) => {
                elapsedTime += ticker.deltaMS;
                const progress = Math.min(elapsedTime / duration, 1);

                this.position.x = startX + (targetX - startX) * progress;

                if (progress >= 1) {
                    this.position.x = targetX;
                    this.visible = false;
                    PIXI.Ticker.shared.remove(animate);
                    this.activeAnimation = null;
                    resolve();
                }
            };

            if (this.activeAnimation) {
                PIXI.Ticker.shared.remove(this.activeAnimation);
            }
            this.activeAnimation = animate;
            PIXI.Ticker.shared.add(animate);
        });
    }

    public moveTo(targetX: number, duration: number = CONFIG.WALK_SPEED): Promise<void> {
        this.isAnimating = true;
        return new Promise((resolve) => {
            const startX = this.x;
            let elapsedTime = 0;

            const animate = (ticker: PIXI.Ticker) => {
                elapsedTime += ticker.deltaMS;
                const progress = Math.min(elapsedTime / duration, 1);

                this.position.x = startX + (targetX - startX) * progress;

                if (progress >= 1) {
                    this.position.x = targetX;
                    PIXI.Ticker.shared.remove(animate);
                    this.activeAnimation = null;
                    this.isAnimating = false;
                    resolve();
                }
            };

            if (this.activeAnimation) {
                PIXI.Ticker.shared.remove(this.activeAnimation);
            }
            this.activeAnimation = animate;
            PIXI.Ticker.shared.add(animate);
        });
    }
}