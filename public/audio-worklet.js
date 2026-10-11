class MonitorCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 4096;
    this.buffer = new Float32Array(this.frameSize);
    this.offset = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (input) {
      let sourceOffset = 0;
      while (sourceOffset < input.length) {
        const count = Math.min(input.length - sourceOffset, this.frameSize - this.offset);
        this.buffer.set(input.subarray(sourceOffset, sourceOffset + count), this.offset);
        this.offset += count;
        sourceOffset += count;
        if (this.offset === this.frameSize) {
          const completed = this.buffer;
          this.port.postMessage(completed, [completed.buffer]);
          this.buffer = new Float32Array(this.frameSize);
          this.offset = 0;
        }
      }
    }
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}

registerProcessor('monitor-capture', MonitorCaptureProcessor);
