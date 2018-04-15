class RSI {
    constructor (rsiPeriod = 14) {
        this.rsiPeriod = rsiPeriod;
    }

    calculateFirstGainLoss(ticks) {
        let sumGain = 0.0;
        let sumLoss = 0.0;

        for(let i = 1; i < ticks.length; i++) {
            let prePrice = ticks[i - 1].price;
            let currentPrice = ticks[i].price;
            let diff = currentPrice - prePrice;

            //console.log(`prePrice: ${prePrice} currentPrice: ${currentPrice}`);

            if (diff > 0) {
                sumGain = sumGain + Math.abs(diff);
            } else {
                sumLoss = sumLoss + Math.abs(diff);
            }
        }

        return { avgGain: sumGain / 14.0, avgLoss: sumLoss / 14.0 };
    }

    calculateGainLoss(prePairData, currentPairData) {
        let diff = currentPairData.price - prePairData.price;
        let avgGain = 0.0;
        let avgLoss = 0.0;

        if (diff > 0) {
            avgGain = ((prePairData.avgGain * 13) + Math.abs(diff)) / 14;
            avgLoss = (prePairData.avgLoss * 13) / 14;
        } else {
            avgGain = ((prePairData.avgLoss * 13) + Math.abs(diff)) / 14;
            avgLoss = (prePairData.avgGain * 13) / 14;
        }

        return { avgGain: avgGain, avgLoss: avgLoss };

        //console.log(`price: ${currentPairData.price}  avgGain: ${currentPairData.avgGain}  avgLoss: ${currentPairData.avgLoss}`)
    }

    calculatePrevGainLoss (ticks) {
        let rsiPeriod = this.rsiPeriod;
        let tempPairData = ticks.map(x => ({...x}));
        tempPairData.reverse();

        let firstRSI = this.calculateFirstGainLoss(tempPairData.slice(0, rsiPeriod));

        tempPairData[rsiPeriod].avgGain = firstRSI.avgGain;
        tempPairData[rsiPeriod].avgLoss = firstRSI.avgLoss;

        for (let i = rsiPeriod + 1; i < tempPairData.length; i++) {
            let currentPairData = tempPairData[i];
            let prePairData = tempPairData[i - 1];
            let gainLoss = this.calculateGainLoss(prePairData, currentPairData);
            currentPairData.avgGain = gainLoss.avgGain;
            currentPairData.avgLoss = gainLoss.avgLoss;
        }

        return tempPairData.reverse();
    }

    calculateCurrentGainLoss(prePairData, currentPairData) {
        return this.calculateGainLoss(prePairData, currentPairData);
    }

    calculateRSI(pairData) {
        if (pairData.avgLoss === 0 && pairData.avgGain !== 0) {
            return 100;
        } else if (pairData.avgLoss === 0) {
            return 0;
        }

        return 100.0 - (100.0 / (1.0 + pairData.avgGain / pairData.avgLoss));
    }
}

module.exports = (rsiPeriod) => (new RSI(rsiPeriod))
