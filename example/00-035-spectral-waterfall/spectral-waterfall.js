// Copyright (c) 2015-2017 Robert Rypuła - https://audio-network.rypula.pl
'use strict';

var
    FFT_SIZE_EXPONENT = 13,
    FFT_FREQUENCY_BIN_SKIP_FACTOR = 47,
    RX_FREQUENCY_MIN = 0,
    RX_FREQUENCY_MAX = 20000,
    SAMPLE_TIME_MS = 250,
    TX_SAMPLE_RATE = 44100,
    TX_AMPLITUDE = 0.1,

    audioMonoIO,
    rxSpectrogram,
    smartTimer,
    rxSampleCount = 0,

    fftSizeExponent,
    fftFrequencyBinSkipFactor,
    rxFrequencyMin,
    rxFrequencyMax,
    txSymbol,
    txSampleRate;

function init() {
    audioMonoIO = new AudioMonoIO(Math.pow(2, FFT_SIZE_EXPONENT));

    initFloatWidget();

    rxSpectrogram = new Spectrogram(document.getElementById('rx-spectrogram'));
    smartTimer = new SmartTimer(SAMPLE_TIME_MS / 1000);
    smartTimer.setHandler(smartTimerHandler);

    onLoopbackCheckboxChange();
}

function onLoopbackCheckboxChange() {
    if (audioMonoIO) {
        audioMonoIO.setLoopback(document.getElementById('loopback-checkbox').checked);
    }
}

function onQuickViewClick(type) {
    switch (type) {
        case 'full':
            fftSizeExponent.setValue(FFT_SIZE_EXPONENT);
            fftFrequencyBinSkipFactor.setValue(FFT_FREQUENCY_BIN_SKIP_FACTOR);
            rxFrequencyMin.setValue(RX_FREQUENCY_MIN);
            rxFrequencyMax.setValue(RX_FREQUENCY_MAX);

            fftSizeExponent.forceUpdate();
            break;
        case 'whistling':
            fftSizeExponent.setValue(13);
            fftFrequencyBinSkipFactor.setValue(1);
            rxFrequencyMin.setValue(900);
            rxFrequencyMax.setValue(2100);

            fftSizeExponent.forceUpdate();
            break;
        case 'physical-layer':
            fftSizeExponent.setValue(FFT_SIZE_EXPONENT);
            fftFrequencyBinSkipFactor.setValue(3);
            rxFrequencyMin.setValue(1400);
            rxFrequencyMax.setValue(6050);

            fftSizeExponent.forceUpdate();
            break;
    }
}

function getFftSize() {
    return Math.pow(2, fftSizeExponent.getValue());
}

function getTransmitFrequency(symbol) {
    return fftFrequencyBinSkipFactor.getValue() * symbol * txSampleRate.getValue() / getFftSize();
}

function setTxSound(symbol) {
    var frequency;

    if (!symbol) {
        audioMonoIO.setPeriodicWave(0);
        return;
    }

    frequency = getTransmitFrequency(symbol);
    audioMonoIO.setPeriodicWave(frequency, TX_AMPLITUDE);
}

function initFloatWidget() {
    fftSizeExponent = new EditableFloatWidget(
        document.getElementById('fft-size-exponent'),
        FFT_SIZE_EXPONENT, 2, 0,
        onFftSizeExponentChange
    );

    fftFrequencyBinSkipFactor = new EditableFloatWidget(
        document.getElementById('fft-frequency-bin-skip-factor'),
        FFT_FREQUENCY_BIN_SKIP_FACTOR, 2, 0,
        null
    );

    rxFrequencyMin = new EditableFloatWidget(
        document.getElementById('rx-frequency-min'),
        RX_FREQUENCY_MIN, 5, 0,
        null
    );

    rxFrequencyMax = new EditableFloatWidget(
        document.getElementById('rx-frequency-max'),
        RX_FREQUENCY_MAX, 5, 0,
        null
    );

    // ---

    txSampleRate = new EditableFloatWidget(
        document.getElementById('tx-sample-rate'),
        TX_SAMPLE_RATE, 5, 0,
        onTxSampleRateChange
    );

    txSymbol = new EditableFloatWidget(
        document.getElementById('tx-symbol'),
        0, 4, 0,
        onTxSymbolChange
    );
    txSymbol.forceUpdate();
}

// ----------------------

function onFftSizeExponentChange() {
    audioMonoIO.setFFTSize(getFftSize());
}

function onTxSymbolChange() {
    var
        symbol = txSymbol.getValue(),
        hertz = getTransmitFrequency(symbol);

    html('#tx-symbol-frequency', hertz.toFixed(2) + ' Hz');
    onTxPlayChange();
}

function onTxSampleRateChange() {
    txSampleRate.getValue();
    onTxSymbolChange();
}

// ----------------------

function onTxPlayChange() {
    var checked = document.getElementById('tx-play').checked;

    setTxSound(checked ? txSymbol.getValue() : 0);
}

// ----------------------

function updateView(frequencyDataInner, loudestBinIndex, rxBinMin, rxBinMax, fftResult) {
    var fftNominalResolution;

    fftNominalResolution = audioMonoIO.getSampleRate() / getFftSize();

    html(
        '#rx-dsp-detail',
        'Sample rate: ' + (audioMonoIO.getSampleRate() / 1000).toFixed(1) + ' kHz<br/>' +
        'FFT size: ' + getFftSize() + '<br/>' +
        'FFT time: ' + (getFftSize() / audioMonoIO.getSampleRate()).toFixed(3) + ' sec<br/>' +
        'FFT native resolution: ' + fftNominalResolution.toFixed(2) + ' Hz<br/>' +
        'FFT skipped resolution: ' + (fftNominalResolution * fftFrequencyBinSkipFactor.getValue()).toFixed(2) + ' Hz'
    );

    rxSpectrogram.add(
        frequencyDataInner,
        document.getElementById('loudest-marker').checked
            ? loudestBinIndex - rxBinMin
            : -1,
        rxBinMin,
        1,
        rxSampleCount % 2
    );

    html('#rx-symbol', loudestBinIndex + ' (' + fftResult.getFrequency(loudestBinIndex).toFixed(2) + ' Hz, ' + fftResult.getDecibel(loudestBinIndex).toFixed(2) + ' dB)');
    html(
        '#rx-log',
        'min&nbsp;&nbsp; : ' + rxBinMin + ' (' + fftResult.getFrequency(rxBinMin).toFixed(2) + ' Hz)<br/>' +
        'max&nbsp;&nbsp; : ' + rxBinMax + ' (' + fftResult.getFrequency(rxBinMax).toFixed(2) + ' Hz)<br/>' +
        'range : ' + (rxBinMax - rxBinMin + 1) + '<br/>'
    );
}

function smartTimerHandler() {
    var
        frequencyData,
        fftResult,
        rxBinMin,
        rxBinMax,
        loudestBinIndex,
        frequencyDataInner = [],
        i;

    if (!document.getElementById('rx-active').checked) {
        return;
    }

    frequencyData = audioMonoIO.getFrequencyData();
    fftResult = new FFTResult(frequencyData, audioMonoIO.getSampleRate());
    fftResult.downconvertScalar(fftFrequencyBinSkipFactor.getValue());
    rxBinMin = fftResult.getBinIndex(rxFrequencyMin.getValue());
    rxBinMax = fftResult.getBinIndex(rxFrequencyMax.getValue());
    loudestBinIndex = fftResult.getLoudestBinIndexInBinRange(rxBinMin, rxBinMax);

    for (i = rxBinMin; i <= rxBinMax; i++) {
        frequencyDataInner.push(fftResult.getDecibel(i));
    }

    updateView(frequencyDataInner, loudestBinIndex, rxBinMin, rxBinMax, fftResult);

    rxSampleCount++;
}
