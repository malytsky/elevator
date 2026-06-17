import * as PIXI from 'pixi.js';
import { CONFIG } from './config';
import { Building } from './Building';

class App {
    private app: PIXI.Application;
    private building!: Building;

    constructor() {
        this.app = new PIXI.Application();
        this.init();
    }

    private async init() {
        await this.app.init({
            width: CONFIG.BUILDING_WIDTH,
            height: CONFIG.FLOORS * CONFIG.FLOOR_HEIGHT + 20,
            backgroundColor: 0xFFFFFF,
            antialias: true,
        });

        const container = document.getElementById('app');
        if (container) {
            container.appendChild(this.app.canvas);
        }

        this.building = new Building();
        this.app.stage.addChild(this.building);
    }
}

new App();