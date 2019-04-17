class Resistence {
    getResistences (ticks, period) {
        if (ticks && ticks.length > 0) {
            let resistences = [];
            let highs = ticks.map(x => x.high).sort();
            for(let i = 0; i < ticks.length; i += period) {
                resistences.push(Math.max(...highs.slice(i, i + period)));
            }

            return resistences.filter(x => x > ticks[0].price);
        }

        return [];
    }

    getFilteredResistences (ticks, shortPeriod = 8, longPeriod = 21) {
        if (ticks && ticks.length > 0) {
            let shortResistences = this.getResistences(ticks, shortPeriod);
            let longResistences = this.getResistences(ticks, longPeriod);
            let resistences = [];
            let eliminateResistences = [];
            shortResistences.push(...longResistences);

            shortResistences.sort((a, b) => a-b);

            for (let i = 0; i < shortResistences.length - 1; i++) {
                for (let j = i + 1; j < shortResistences.length; j++) {
                    let diffPrices = ((shortResistences[j] - shortResistences[i]) * 100) / shortResistences[i];

                    //console.log(shortResistences.length + ' ' + diffPrices + " " + i + " " + shortResistences[i] + " " + j + " " + shortResistences[j]);

                    if (diffPrices < 1) {
                        eliminateResistences.push(shortResistences[j])
                    } else {
                        i = j - 1;
                        break;
                    }
                }
            }

            resistences = shortResistences.filter(x => eliminateResistences.indexOf(x) < 0);
            resistences = resistences.filter(x => ((x - ticks[0].price) * 100 / ticks[0].price) > 1);

            return resistences;
        }

        return [];
    }
}

module.exports = new Resistence()
