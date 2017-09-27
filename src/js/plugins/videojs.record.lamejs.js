/**
 * @file videojs.record.lamejs.js
 */

import RecordBase from 'video.js';

/**
 * Audio-only engine for the lamejs library.
 *
 * @class
 * @augments RecordBase
 */
class LamejsEngine extends RecordBase {
    /**
     * The constructor function for the class.
     *
     * @private
     * @param {(videojs.Player|Object)} player - Video.js player instance.
     * @param {Object} options - Player options.
     */
    constructor(player, options) {
        super(player, options);
    }

    /**
     * Setup recording engine.
     */
    setup(stream, mediaType, debug) {
        this.inputStream = stream;
        this.mediaType = mediaType;
        this.debug = debug;

        let config = {
            debug: this.debug,
            sampleRate: this.sampleRate
        };

        this.audioContext = new AudioContext();
        this.audioSourceNode = this.audioContext.createMediaStreamSource(
            this.inputStream);
        this.processor = this.audioContext.createScriptProcessor(
            16384, 1, 1);
        config.sampleRate = this.audioContext.sampleRate;

        this.engine = new Worker(this.audioWorkerURL);
        this.engine.onmessage = this.onWorkerMessage.bind(this);

        this.engine.postMessage({cmd: 'init', config: config});
    }

    /**
     * Start recording.
     */
    start() {
        this.processor.onaudioprocess = this.onAudioProcess.bind(this);
        this.audioSourceNode.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    /**
     * Stop recording.
     */
    stop() {
        this.audioSourceNode.disconnect();
        this.processor.disconnect();
        this.processor.onaudioprocess = null;

        this.engine.postMessage({cmd: 'finish'});
    }

    /**
     * Received a message from the worker.
     */
    onWorkerMessage(ev) {
        switch (ev.data.cmd) {
            case 'end':
                this.onStopRecording(new Blob(ev.data.buf,
                    {type: 'audio/mp3'}));
                break;

            case 'error':
                this.player().trigger('error', ev.data.error);
                break;

            default:
                // invalid message received
                this.player().trigger('error', ev.data);
                break;
        }
    }

    /**
     * Continous encoding of audio data.
     */
    onAudioProcess(ev) {
        // send microphone data to LAME for MP3 encoding while recording
        let data = ev.inputBuffer.getChannelData(0);

        this.engine.postMessage({cmd: 'encode', buf: data});
    }
}

// expose plugin
videojs.LamejsEngine = LamejsEngine;

export default LamejsEngine;
