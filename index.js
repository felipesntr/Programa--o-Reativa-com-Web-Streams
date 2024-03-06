import { fromEvent, interval, map, merge, switchMap, takeUntil } from "./operators.js";

const canvas = document.getElementById('canvas');
const clearButton = document.getElementById('clearbtn');
const ctx = canvas.getContext('2d');

const mouseEvents = {
    down: 'mousedown',
    move: 'mousemove',
    up: 'mouseup',
    leave: 'mouseleave',

    touchstart: 'touchstart',
    touchmove: 'touchmove',
    touchend: 'touchend',

    click: 'click',
}

const getMousePosition = (canvasDom, eventValue) => {
    const rect = canvasDom.getBoundingClientRect();
    return {
        x: eventValue.clientX - rect.left,
        y: eventValue.clientY - rect.top
    }
}

const resetCanvas = (width, height) => {
    const parent = canvas.parentElement;
    canvas.width = width || parent.clientWidth * 0.9;
    canvas.height = height || parent.clientHeight * 0.9;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 4;
}

resetCanvas();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const store = {
    db: [],
    get() {
        return this.db;
    },
    set(value) {
        this.db.push(value);
    },
    clear() {
        this.db.length = 0;
    }
}

const touchToMouse = (touchEvent, mouseEvent) => {
    const [touch] = touchEvent.touches.length ?
        touchEvent.touches :
        touchEvent.changedTouches;

    return new MouseEvent(mouseEvent, {
        clientX: touch.clientX,
        clientY: touch.clientY
    })
}

merge([
    fromEvent(canvas, mouseEvents.down),
    fromEvent(canvas, mouseEvents.touchstart)
        .pipeThrough(map(e => touchToMouse(e, mouseEvents.down))),
])
    .pipeThrough(switchMap(e => {
        return merge([
            fromEvent(canvas, mouseEvents.move),
            fromEvent(canvas, mouseEvents.touchmove)
                .pipeThrough(map(e => touchToMouse(e, mouseEvents.move))),
        ]).pipeThrough(
            takeUntil(merge([
                fromEvent(canvas, mouseEvents.up),
                fromEvent(canvas, mouseEvents.leave),
                fromEvent(canvas, mouseEvents.touchend)
                    .pipeThrough(map(e => touchToMouse(e, mouseEvents.up))),
            ])))
    }))
    .pipeThrough(map(function ([mouseDown, mouseMovie]) {
        this._lastPosition = this._lastPosition || mouseDown;
        const [from, to] = [this._lastPosition, mouseMovie].map(item => getMousePosition(canvas, item));
        this._lastPosition = mouseMovie.type === mouseEvents.up || mouseMovie.type === mouseEvents.leave ? null : mouseMovie;
        return { from, to }
    }))
    .pipeTo(new WritableStream({
        write({ from, to }) {
            store.set({ from, to });
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        }
    }));

fromEvent(clearButton, 'click')
    .pipeTo(new WritableStream({
        async write(chunk) {
            ctx.beginPath();
            ctx.strokeStyle = 'red';
            for (const { from, to } of store.get()) {
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
                await sleep(5);
            }
            store.clear();
            resetCanvas(canvas.width, canvas.height);
        }
    }));