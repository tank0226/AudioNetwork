// Copyright (c) 2015-2016 Robert Rypuła - https://audio-network.rypula.pl
'use strict';

var
    // import stuff from AudioNetwork lib
    FrequencyDomainChart = AudioNetwork.Visualizer.FrequencyDomainChart,
    ConstellationDiagram = AudioNetwork.Visualizer.ConstellationDiagram,
    CarrierGenerate = AudioNetwork.Common.CarrierGenerate,
    WindowFunction = AudioNetwork.Common.WindowFunction,
    SampleChart = AudioNetwork.Visualizer.SampleChart,
    Queue = AudioNetwork.Common.Queue,
    Util = AudioNetwork.Common.Util,

    // default visualizers settings
    SAMPLE_CHART_HEIGHT = 50,
    SAMPLE_CHART_RADIUS = 1,
    SAMPLE_CHART_BAR_WIDTH = 1,
    SAMPLE_CHART_BAR_SPACING_WIDTH = 0,
    FREQUENCY_BIN_CHART_HEIGHT = 250,
    FREQUENCY_BIN_CHART_RADIUS = 2,
    FREQUENCY_BIN_CHART_BAR_WIDTH = 5,
    FREQUENCY_BIN_CHART_BAR_SPACING_WIDTH = 1,
    CONSTELLATION_DIAGRAM_WIDTH = 290,
    CONSTELLATION_DIAGRAM_HEIGHT = 290,
    CONSTELLATION_DIAGRAM_POINT_HISTORY = 1,
    FREQUENCY_BIN_ITERATION_CHART_WIDTH = 130,
    FREQUENCY_BIN_ITERATION_CHART_HEIGHT = 130,
    FREQUENCY_BIN_ITERATION_CHART_SIZE = 25,

    // settings (user is able to update those values via form)
    sineSampleSize = 1130,
    separateSineParameter = [
        { amplitude: 0.3, samplePerPeriod: 28, phase: 0 },
        { amplitude: 0.3, samplePerPeriod: 20, phase: 0 },
        { amplitude: 0.3, samplePerPeriod: 16, phase: 0 }
    ],
    windowSampleOffset = 0,
    windowSampleSize = 1024,
    windowFunctionEnabled = 1,
    powerDecibelMin = -80,
    frequencyBinSize = 160,
    frequencyBinSamplePerPeriodMax = 50,
    frequencyBinSamplePerPeriodMin = 10,
    frequencyBinToExplainIndex = Math.round(frequencyBinSize * 0.5),
    frequencyBinToExplainIterationOffset = Math.round(0.5 * windowSampleSize - 15),

    // helpers for sine creation
    separateSineCarrierGenerate = [],

    // data buffers
    separateSineQueue = [],
    summedSineQueue,
    timeDomainRawQueue,
    windowFunctionQueue,
    timeDomainProcessedQueue,
    frequencyDomainQueue,
    frequencyBinQueue,
    constellationDiagramQueue,
    timeDomainProcessedDuplicateQueue,    // its a duplicate of timeDomainProcessedQueue
    frequencyBinToExplainQueue = [],

    // data visualizers
    separateSineChart = [],
    summedSineChart,
    timeDomainRawChart,
    windowFunctionChart,
    timeDomainProcessedChart,
    frequencyDomainChart,
    constellationDiagramChart,
    timeDomainProcessedDuplicateChart,     // its a duplicate of timeDomainProcessedChart
    frequencyBinToExplainChart = [];

// ----------------

function separateSineInitialize() {
    var i, carrierGenerate, queue, sampleChart, element;

    for (i = 0; i < separateSineParameter.length; i++) {
        carrierGenerate = new CarrierGenerate(separateSineParameter[i].samplePerPeriod);
        queue =  new Queue(sineSampleSize);
        element = document.getElementById('separate-sine-' + i);
        sampleChart = new SampleChart(element, sineSampleSize, SAMPLE_CHART_HEIGHT, queue);
        separateSineCarrierGenerate.push(carrierGenerate);
        separateSineQueue.push(queue);
        separateSineChart.push(sampleChart);
    }
}

function separateSineUpdate() {
    var i, j, carrierGenerate, queue, sampleChart;

    for (i = 0; i < separateSineParameter.length; i++) {
        carrierGenerate = separateSineCarrierGenerate[i];
        queue =  separateSineQueue[i];
        sampleChart = separateSineChart[i];

        carrierGenerate.setSamplePerPeriod(separateSineParameter[i].samplePerPeriod);
        queue.setSizeMax(sineSampleSize);
        sampleChart.setWidth(sineSampleSize);

        carrierGenerate.reset();
        carrierGenerate.addToQueue({
            amplitude: separateSineParameter[i].amplitude,
            duration: sineSampleSize,
            phase: separateSineParameter[i].phase / 360
        });

        for (j = 0; j < sineSampleSize; j++) {
            queue.pushEvenIfFull(carrierGenerate.getSample());
            carrierGenerate.nextSample();
        }
    }
}

// ----------------

function summedSineInitialize() {
    var element;

    summedSineQueue = new Queue(sineSampleSize);
    element = document.getElementById('summed-sine');
    summedSineChart = new SampleChart(element, sineSampleSize, SAMPLE_CHART_HEIGHT, summedSineQueue);

    element = document.getElementById('summed-sine-visualizer-overlay');
    element.style.height = SAMPLE_CHART_HEIGHT + 'px';
    element.style.top = -SAMPLE_CHART_HEIGHT + 'px';
}

function summedSineUpdate() {
    var i, j, sampleSum;

    summedSineQueue.setSizeMax(sineSampleSize);
    for (i = 0; i < sineSampleSize; i++) {
        sampleSum = 0;
        for (j = 0; j < separateSineQueue.length; j++) {
            sampleSum += separateSineQueue[j].getItem(i);
        }
        summedSineQueue.pushEvenIfFull(sampleSum);
    }
    summedSineChart.setWidth(sineSampleSize);
}

// ----------------

function timeDomainRawInitialize() {
    var element, chartWidth;

    timeDomainRawQueue = new Queue(windowSampleSize);
    element = document.getElementById('time-domain-raw');
    chartWidth = windowSampleSize * (SAMPLE_CHART_BAR_WIDTH + SAMPLE_CHART_BAR_SPACING_WIDTH);
    timeDomainRawChart = new SampleChart(
        element, chartWidth, SAMPLE_CHART_HEIGHT, timeDomainRawQueue,
        SAMPLE_CHART_RADIUS, SAMPLE_CHART_BAR_WIDTH, SAMPLE_CHART_BAR_SPACING_WIDTH
    );
}

function timeDomainRawUpdate() {
    var i, chartWidth, element;

    timeDomainRawQueue.setSizeMax(windowSampleSize);
    for (i = 0; i < windowSampleSize; i++) {
        timeDomainRawQueue.pushEvenIfFull(
            summedSineQueue.getItem(windowSampleOffset + i)
        );
    }
    chartWidth = windowSampleSize * (SAMPLE_CHART_BAR_WIDTH + SAMPLE_CHART_BAR_SPACING_WIDTH);
    timeDomainRawChart.setWidth(chartWidth);

    element = document.getElementById('summed-sine-visualizer-overlay');
    element.style.left = windowSampleOffset + 'px';
    element.style.width = windowSampleSize + 'px';
}

// ----------------

function windowFunctionInitialize() {
    var element, chartWidth;

    windowFunctionQueue = new Queue(windowSampleSize);
    element = document.getElementById('window-function');
    chartWidth = windowSampleSize * (SAMPLE_CHART_BAR_WIDTH + SAMPLE_CHART_BAR_SPACING_WIDTH);
    windowFunctionChart = new SampleChart(
        element, chartWidth, SAMPLE_CHART_HEIGHT, windowFunctionQueue,
        SAMPLE_CHART_RADIUS, SAMPLE_CHART_BAR_WIDTH, SAMPLE_CHART_BAR_SPACING_WIDTH
    );
}

function windowFunctionUpdate() {
    var i, chartWidth;

    windowFunctionQueue.setSizeMax(windowSampleSize);
    for (i = 0; i < windowSampleSize; i++) {
        windowFunctionQueue.pushEvenIfFull(
            windowFunctionEnabled ? WindowFunction.blackmanNuttall(i, windowSampleSize) : 1
        );
    }
    chartWidth = windowSampleSize * (SAMPLE_CHART_BAR_WIDTH + SAMPLE_CHART_BAR_SPACING_WIDTH);
    windowFunctionChart.setWidth(chartWidth);
}

// ----------------

function timeDomainProcessedInitialize() {
    var element, chartWidth;

    timeDomainProcessedQueue = new Queue(windowSampleSize);
    element = document.getElementById('time-domain-processed');
    chartWidth = windowSampleSize * (SAMPLE_CHART_BAR_WIDTH + SAMPLE_CHART_BAR_SPACING_WIDTH);
    timeDomainProcessedChart = new SampleChart(
        element, chartWidth, SAMPLE_CHART_HEIGHT, timeDomainProcessedQueue,
        SAMPLE_CHART_RADIUS, SAMPLE_CHART_BAR_WIDTH, SAMPLE_CHART_BAR_SPACING_WIDTH
    );
}

function timeDomainProcessedUpdate() {
    var i, chartWidth;

    timeDomainProcessedQueue.setSizeMax(windowSampleSize);
    for (i = 0; i < windowSampleSize; i++) {
        timeDomainProcessedQueue.pushEvenIfFull(
            windowFunctionQueue.getItem(i) * timeDomainRawQueue.getItem(i)
        );
    }
    chartWidth = windowSampleSize * (SAMPLE_CHART_BAR_WIDTH + SAMPLE_CHART_BAR_SPACING_WIDTH);
    timeDomainProcessedChart.setWidth(chartWidth);
}

// ----------------

function discreteFourierTransformInitialize() {
    var element, frequencyDomainChartWidth;

    frequencyDomainQueue = new Queue(frequencyBinSize);
    frequencyBinQueue = new Queue(frequencyBinSize);
    element = document.getElementById('frequency-domain');
    frequencyDomainChartWidth = frequencyBinSize *
        (FREQUENCY_BIN_CHART_BAR_WIDTH + FREQUENCY_BIN_CHART_BAR_SPACING_WIDTH);
    frequencyDomainChart = new FrequencyDomainChart(
        element, frequencyDomainChartWidth, FREQUENCY_BIN_CHART_HEIGHT, frequencyDomainQueue,
        powerDecibelMin,
        FREQUENCY_BIN_CHART_RADIUS, FREQUENCY_BIN_CHART_BAR_WIDTH, FREQUENCY_BIN_CHART_BAR_SPACING_WIDTH
    );

    element = document.getElementById('frequency-domain-visualizer-overlay');
    element.style.width = (FREQUENCY_BIN_CHART_BAR_WIDTH + FREQUENCY_BIN_CHART_BAR_SPACING_WIDTH) + 'px';
    element.style.height = FREQUENCY_BIN_CHART_HEIGHT + 'px';
    element.style.top = -FREQUENCY_BIN_CHART_HEIGHT + 'px';
}

function discreteFourierTransformUpdate() {
    var binStep, i, samplePerPeriod, frequencyBin, chartWidth;

    frequencyDomainQueue.setSizeMax(frequencyBinSize);
    binStep = (frequencyBinSamplePerPeriodMax - frequencyBinSamplePerPeriodMin) / frequencyBinSize;
    for (i = 0; i < frequencyBinSize; i++) {
        samplePerPeriod = frequencyBinSamplePerPeriodMax - i * binStep;
        frequencyBin = getFrequencyBin(timeDomainProcessedQueue, samplePerPeriod);
        frequencyDomainQueue.pushEvenIfFull(frequencyBin.powerDecibel);
        frequencyBinQueue.pushEvenIfFull(frequencyBin);
    }
    chartWidth = frequencyBinSize * (FREQUENCY_BIN_CHART_BAR_WIDTH + FREQUENCY_BIN_CHART_BAR_SPACING_WIDTH);
    frequencyDomainChart.setWidth(chartWidth);
    frequencyDomainChart.setPowerDecibelMin(powerDecibelMin);
}

function getFrequencyBin(timeDomainQueue, samplePerPeriod) {
    var i, r, x, y, sample, result, detail, power;

    result = {
        samplePerPeriod: samplePerPeriod,
        real: 0,
        imm: 0,
        powerDecibel: 0,
        phase: 0,
        detail: []
    };
    for (i = 0; i < timeDomainQueue.getSize(); i++) {
        sample = timeDomainQueue.getItem(i);
        r = 2 * Math.PI * i / samplePerPeriod;
        x = Math.sin(r);
        y = -Math.cos(r);

        detail = {
            realUnit: x,
            immUnit: y,
            real: sample * x,
            imm: sample * y
        };
        result.real += detail.real;
        result.imm += detail.imm;

        result.detail.push(detail);
    }

    result.real /= timeDomainQueue.getSize();
    result.imm /= timeDomainQueue.getSize();

    power = Math.sqrt(result.real * result.real + result.imm * result.imm);

    result.powerDecibel = 10 * Math.log(power) / Math.LN10;
    result.powerDecibel = result.powerDecibel < powerDecibelMin ? powerDecibelMin : result.powerDecibel;

    result.phase = Util.findUnitAngle(result.real, result.imm);

    return result;
}

// ----------------

function constellationDiagramInitialize() {
    var element;

    constellationDiagramQueue = new Queue(CONSTELLATION_DIAGRAM_POINT_HISTORY);
    element = document.getElementById('constellation-diagram');
    constellationDiagramChart = new ConstellationDiagram(
        element, CONSTELLATION_DIAGRAM_WIDTH, CONSTELLATION_DIAGRAM_HEIGHT, constellationDiagramQueue, powerDecibelMin
    );
}

function constellationDiagramUpdate() {
    var frequencyBin;

    frequencyBin = frequencyBinQueue.getItem(frequencyBinToExplainIndex);
    constellationDiagramQueue.pushEvenIfFull({
        powerDecibel: frequencyBin.powerDecibel,
        phase: frequencyBin.phase
    });
    constellationDiagramChart.setPowerDecibelMin(powerDecibelMin);
}

// ----------------

function frequencyBinExplanationInitialize() {
    var element, chartWidth, i, chartTemplate, chartAllTemplate, queue, chart;

    // time domain duplicate
    timeDomainProcessedDuplicateQueue = timeDomainProcessedQueue;     // exactly same data as timeDomainProcessedQueue
    element = document.getElementById('time-domain-processed-duplicate');
    chartWidth = windowSampleSize * (SAMPLE_CHART_BAR_WIDTH + SAMPLE_CHART_BAR_SPACING_WIDTH);
    timeDomainProcessedDuplicateChart = new SampleChart(
        element, chartWidth, SAMPLE_CHART_HEIGHT, timeDomainProcessedDuplicateQueue,
        SAMPLE_CHART_RADIUS, SAMPLE_CHART_BAR_WIDTH, SAMPLE_CHART_BAR_SPACING_WIDTH
    );

    // range marker
    element = document.getElementById('time-domain-processed-duplicate-visualizer-overlay');
    element.style.height = SAMPLE_CHART_HEIGHT + 'px';
    element.style.top = -SAMPLE_CHART_HEIGHT + 'px';

    // iteration charts - generate html
    element = document.getElementById('frequency-bin-iteration-container');
    chartTemplate = element.innerHTML;
    chartAllTemplate = '';
    for (i = 0; i < FREQUENCY_BIN_ITERATION_CHART_SIZE; i++) {
        chartAllTemplate += chartTemplate.replace(/\[\[ index \]\]/g, i.toString());
    }
    element.innerHTML = chartAllTemplate;

    // iteration charts - initialize
    for (i = 0; i < FREQUENCY_BIN_ITERATION_CHART_SIZE; i++) {
        queue = new Queue(2);
        element = document.getElementById('frequency-bin-iteration-' + i);
        chart = new ConstellationDiagram(       // TODO change it
            element, FREQUENCY_BIN_ITERATION_CHART_WIDTH, FREQUENCY_BIN_ITERATION_CHART_HEIGHT, queue, -1
        );
        frequencyBinToExplainQueue.push(queue);
        frequencyBinToExplainChart.push(chart);
    }
}

function frequencyBinExplanationUpdate() {
    var element, chartWidth, i, queue, frequencyBin, frequencyBinIteration;

    // update frequency bin marker
    element = document.getElementById('frequency-domain-visualizer-overlay');
    element.style.left =
        ((FREQUENCY_BIN_CHART_BAR_WIDTH + FREQUENCY_BIN_CHART_BAR_SPACING_WIDTH) * frequencyBinToExplainIndex) + 'px';

    // update duplicated time domain chart
    chartWidth = windowSampleSize * (SAMPLE_CHART_BAR_WIDTH + SAMPLE_CHART_BAR_SPACING_WIDTH);
    timeDomainProcessedDuplicateChart.setWidth(chartWidth);

    // range marker update
    element = document.getElementById('time-domain-processed-duplicate-visualizer-overlay');
    element.style.left = frequencyBinToExplainIterationOffset + 'px';
    element.style.width = FREQUENCY_BIN_ITERATION_CHART_SIZE + 'px';

    // iteration charts
    for (i = 0; i < FREQUENCY_BIN_ITERATION_CHART_SIZE; i++) {
        queue = frequencyBinToExplainQueue[i];
        element = document.getElementById('frequency-bin-iteration-label-' + i);
        frequencyBin = frequencyBinQueue.getItem(frequencyBinToExplainIndex);
        frequencyBinIteration = frequencyBin.detail[frequencyBinToExplainIterationOffset + i];
        queue.pushEvenIfFull({
            powerDecibel: (
                Math.sqrt(frequencyBinIteration.real * frequencyBinIteration.real + frequencyBinIteration.imm * frequencyBinIteration.imm) * -1
            ),    // TODO change it
            phase: Util.findUnitAngle(frequencyBinIteration.real, frequencyBinIteration.imm)         // TODO change it
        });
        queue.pushEvenIfFull({
            powerDecibel: 0,    // TODO change it
            phase: Util.findUnitAngle(frequencyBinIteration.realUnit, frequencyBinIteration.immUnit)         // TODO change it
        });
        element.innerHTML = (frequencyBinToExplainIterationOffset + i).toString();
    }
}

// ----------------

function getSamplePerPeriodFromIndex(index) {
    var step = (frequencyBinSamplePerPeriodMax - frequencyBinSamplePerPeriodMin) / frequencyBinSize;

    return frequencyBinSamplePerPeriodMax - step * index;
}

function parseIntFromForm(elementId) {
    return parseInt(document.getElementById(elementId).value);
}

function parseFloatFromForm(elementId) {
    return parseFloat(document.getElementById(elementId).value);
}

function dataBindingTemplateToCode() {
    var i, ssp;

    sineSampleSize = parseIntFromForm('form-sine-sample-size');
    for (i = 0; i < separateSineParameter.length; i++) {
        ssp = separateSineParameter[i];
        ssp.samplePerPeriod = parseFloatFromForm('form-sine-' + i + '-sample-per-period');
        ssp.amplitude = parseFloatFromForm('form-sine-' + i + '-amplitude');
        ssp.phase = parseFloatFromForm('form-sine-' + i + '-phase');
    }
    windowSampleOffset = parseIntFromForm('form-window-sample-offset');
    windowSampleSize = parseIntFromForm('form-window-sample-size');
    windowFunctionEnabled = !!document.getElementById('form-window-function-enabled').checked;
    powerDecibelMin = parseIntFromForm('form-power-decibel-min');
    frequencyBinSize = parseIntFromForm('form-frequency-bin-size');
    frequencyBinSamplePerPeriodMax = parseFloatFromForm('form-frequency-bin-sample-per-period-max');
    frequencyBinSamplePerPeriodMin = parseFloatFromForm('form-frequency-bin-sample-per-period-min');
    frequencyBinToExplainIndex = parseIntFromForm('form-frequency-bin-to-explain-index');
    frequencyBinToExplainIterationOffset = parseIntFromForm('form-frequency-bin-to-explain-iteration-offset');
}

function dataBindingCodeToTemplate() {
    var i, ssp;

    document.getElementById('form-sine-sample-size').value = sineSampleSize;
    for (i = 0; i < separateSineParameter.length; i++) {
        ssp = separateSineParameter[i];
        document.getElementById('form-sine-' + i + '-sample-per-period').value = ssp.samplePerPeriod;
        document.getElementById('form-sine-' + i + '-amplitude').value = ssp.amplitude;
        document.getElementById('form-sine-' + i + '-phase').value = ssp.phase;
    }
    document.getElementById('form-window-sample-offset').value = windowSampleOffset;
    document.getElementById('form-window-sample-size').value = windowSampleSize;
    document.getElementById('form-window-function-enabled').checked = windowFunctionEnabled ? true : false;
    document.getElementById('form-power-decibel-min').value = powerDecibelMin;
    document.getElementById('form-frequency-bin-size').value = frequencyBinSize;
    document.getElementById('form-frequency-bin-sample-per-period-max').value = frequencyBinSamplePerPeriodMax;
    document.getElementById('form-frequency-bin-sample-per-period-min').value = frequencyBinSamplePerPeriodMin;
    document.getElementById('form-frequency-bin-to-explain-index').value = frequencyBinToExplainIndex;
    document.getElementById('frequency-bin-sample-per-period').innerHTML =
        getSamplePerPeriodFromIndex(frequencyBinToExplainIndex);
    document.getElementById('frequency-bin-power-decibel').innerHTML =
        (Math.round(frequencyBinQueue.getItem(frequencyBinToExplainIndex).powerDecibel * 100) / 100).toString();
    document.getElementById('frequency-bin-phase').innerHTML =
        (Math.round(frequencyBinQueue.getItem(frequencyBinToExplainIndex).phase * 360)).toString();
    document.getElementById('form-frequency-bin-to-explain-iteration-offset').value = frequencyBinToExplainIterationOffset;
}

function formSineDataChanged() {
    dataBindingTemplateToCode();

    separateSineUpdate();
    summedSineUpdate();
    timeDomainRawUpdate();
    windowFunctionUpdate();
    timeDomainProcessedUpdate();
    discreteFourierTransformUpdate();
    constellationDiagramUpdate();
    frequencyBinExplanationUpdate();

    dataBindingCodeToTemplate();
}

function formWindowDataChanged() {
    dataBindingTemplateToCode();

    timeDomainRawUpdate();
    windowFunctionUpdate();
    timeDomainProcessedUpdate();
    discreteFourierTransformUpdate();
    constellationDiagramUpdate();
    frequencyBinExplanationUpdate();

    dataBindingCodeToTemplate();
}

function formWindowFunctionDataChanged() {
    dataBindingTemplateToCode();

    windowFunctionUpdate();
    timeDomainProcessedUpdate();
    discreteFourierTransformUpdate();
    constellationDiagramUpdate();
    frequencyBinExplanationUpdate();

    dataBindingCodeToTemplate();
}

function formFrequencyDomainDataChanged() {
    dataBindingTemplateToCode();

    discreteFourierTransformUpdate();
    constellationDiagramUpdate();
    frequencyBinExplanationUpdate();

    dataBindingCodeToTemplate();
}

function formFrequencyBinExplanationDataChanged() {
    dataBindingTemplateToCode();

    constellationDiagramUpdate();
    frequencyBinExplanationUpdate();

    dataBindingCodeToTemplate();
}

function startApp() {
    separateSineInitialize();
    separateSineUpdate();

    summedSineInitialize();
    summedSineUpdate();

    timeDomainRawInitialize();
    timeDomainRawUpdate();

    windowFunctionInitialize();
    windowFunctionUpdate();

    timeDomainProcessedInitialize();
    timeDomainProcessedUpdate();

    discreteFourierTransformInitialize();
    discreteFourierTransformUpdate();

    constellationDiagramInitialize();
    constellationDiagramUpdate();

    frequencyBinExplanationInitialize();
    frequencyBinExplanationUpdate();

    dataBindingCodeToTemplate();
}

