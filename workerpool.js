class WorkerPool {
    constructor(size) {
        this.size = size;
        this.workers = [];
        this.taskQueue = [];
        
        // Create Worker
        for (let i = 0; i < size; i++) {
            const worker = new Worker('./optimizer.worker.js', { type: 'module' });
            worker.onmessage = this.handleMessage.bind(this, worker);
            worker.onerror = this.handleError.bind(this, worker);
            this.workers.push({ worker, busy: false });
        }
    }
    
    handleMessage(worker, event) {
        const workerData = this.workers.find(w => w.worker === worker);
        if (!workerData) return;
        
        workerData.busy = false;
        const { resolve } = workerData.currentTask;
        workerData.currentTask = null;
        resolve(event.data);
        
        this.processNextTask(workerData);
    }
    
    handleError(worker, error) {
        const workerData = this.workers.find(w => w.worker === worker);
        if (!workerData) return;
        
        workerData.busy = false;
        const { reject } = workerData.currentTask;
        workerData.currentTask = null;
        reject(error);
        
        this.processNextTask(workerData);
    }
    
    processNextTask(workerData) {
        if (this.taskQueue.length === 0) return;
        
        const task = this.taskQueue.shift();
        workerData.busy = true;
        workerData.currentTask = task;
        workerData.worker.postMessage(task.data);
    }
    
    runTask(data) {
        return new Promise((resolve, reject) => {
            const task = { data, resolve, reject };
            
            // 查找空闲 worker
            const idleWorker = this.workers.find(w => !w.busy);
            
            if (idleWorker) {
                idleWorker.busy = true;
                idleWorker.currentTask = task;
                idleWorker.worker.postMessage(data);
            } else {
                this.taskQueue.push(task);
            }
        });
    }
    
    terminate() {
        this.workers.forEach(({ worker }) => worker.terminate());
        this.workers = [];
        this.taskQueue = [];
    }
}

export { WorkerPool };