class Support {
    getSupports (ticks, period) {
        if (ticks && ticks.length > 0) {
            let supports = [];
            let lows = ticks.map(x => x.low).sort();
            for(let i = 0; i < ticks.length; i += period) {
                supports.push(Math.min(...lows.slice(i, i + period)));
            }

            return supports;
        }

        return [];
    }

    getFilteredSupports (ticks, shortPeriod = 8, longPeriod = 21) {
        if (ticks && ticks.length) {
            let shortSupports = this.getSupports(ticks, shortPeriod);
            let longSupports = this.getSupports(ticks, longPeriod);
            let supports = [];
            let eliminateSupports = [];
            shortSupports.push(...longSupports);
            shortSupports = shortSupports.filter(x => x < ticks[0].price);

            shortSupports.sort((a, b) => b-a);

            for (let i = 0; i < shortSupports.length - 1; i++) {
                for (let j = i + 1; j < shortSupports.length; j++) {
                    let diffPrices = ((shortSupports[i] - shortSupports[j]) * 100) / shortSupports[j];

                    if (diffPrices < 3) {
                        eliminateSupports.push(shortSupports[j])
                    } else {
                        i = j - 1;
                        break;
                    }
                }
            }

            supports = shortSupports.filter(x => eliminateSupports.indexOf(x) < 0 && ((ticks[0].price - x) * 100 / x) > 3 );

            return supports;
        }

        return [];
    }
}

module.exports = new Support()
