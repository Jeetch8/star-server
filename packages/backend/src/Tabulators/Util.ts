import { candidate, genericResults, genericSummaryData, roundResults, totalScore } from "@equal-vote/star-vote-shared/domain_model/ITabulators";
import { ballot, voter } from "@equal-vote/star-vote-shared/domain_model/ITabulators";

declare namespace Intl {
  class ListFormat {
    constructor(locales?: string | string[], options?: {});
    public format: (items: string[]) => string;
  }
}
// converts list of strings to string with correct grammar ([a,b,c] => 'a, b, and c')
export const commaListFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export function sortTotalScores(totalScores : totalScore[], candidates : candidate[]){
  return totalScores.sort((a: totalScore, b: totalScore) => {
    if (a.score > b.score) return -1
    if (a.score < b.score) return 1
    if (candidates[a.index].tieBreakOrder < candidates[b.index].tieBreakOrder) return -1
    return 1
  });
}

// Format a Timestamp value into a compact string for display;
function formatTimestamp(value : string) {
  const d = new Date(Date.parse(value));
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const year = d.getFullYear();
  const currentYear = new Date().getFullYear();
  const hour = d.getHours();
  const minute = d.getMinutes();

  const fullDate =
    year === currentYear
      ? `${month}/${date}`
      : year >= 2000 && year < 2100
        ? `${month}/${date}/${year - 2000}`
        : `${month}/${date}/${year}`;

  const timeStamp = `${fullDate} ${hour}:${minute}`;
  return timeStamp;
}



const isScore = (value : any) =>
  !isNaN(value) && (value === null || (value > -10 && value < 10));

const transformScore = (value : number) => {
  // minScore and maxScore were undefined when moving the file to typescript, so I'm hard coding them for now
  const minScore = 0;
  const maxScore = 5;
  value ? Math.min(maxScore, Math.max(minScore, value)) : 0;
}

// Functions to parse Timestamps
const isTimestamp = (value : any) => !isNaN(Date.parse(value));
const transformTimestamp = (value : any) => formatTimestamp(value);

// Functions to parse everything else
const isAny = (value : any) => true;
const transformAny = (value : any) => (value ? value.toString().trim() : "");

// Column types to recognize in Cast Vote Records passed as CSV data
const columnTypes = [
  { test: isScore, transform: transformScore },
  { test: isTimestamp, transform: transformTimestamp },
  // Last row MUST accept anything!
  { test: isAny, transform: transformAny }
];

function getTransforms(header : any, data : string[][]) {
  const transforms : any[] = [];
  const rowCount = Math.min(data.length, 3);
  header.forEach((title : string, n : number) => {
    var transformIndex = 0;
    if (title === "Timestamp") {
      transformIndex = 1;
    } else {
      for (let i = 0; i < rowCount; i++) {
        const value = data[i][n];
        const index = columnTypes.findIndex((element) => element.test(value));
        if (index > transformIndex) {
          transformIndex = index;
        }
        if (transformIndex >= columnTypes.length) {
          break;
        }
      }
    }
    // We don't have to check for out-of-bound index because
    // the last row in columnTypes accepts anything
    transforms.push(columnTypes[transformIndex].transform);
  });
  return transforms;
}

function getStarBallotValidity(ballot: ballot) {
    const minScore = 0
    const maxScore = 5
    let isUnderVote = true
    for (let i = 0; i < ballot.length; i++) {
        if (ballot[i] < minScore || ballot[i] > maxScore) {
            return { isValid: false, isUnderVote: false }
        }
        if (ballot[i] > minScore) {
            isUnderVote = false
        }
    }
    return { isValid: true, isUnderVote: isUnderVote }
}

export const makeBoundsTest = (minValue:number, maxValue:number) => {
	return [
		'nOutOfBoundsVotes',
		(ballot: number[]) => ballot.filter(b => b < minValue || maxValue < b).length > 0
	] as const;
}

export const makeUnderVoteTest = (underVoteValue:number = 0) => {
	return [
		'nUndervotes',
		(ballot: number[]) => ballot.filter(b => b === underVoteValue).length == ballot.length
	] as const;
}

type StatTestPair = Readonly<[string, Function]>;

const filterInitialVotes = (data: ballot[], tests: StatTestPair[]): [ballot[], {[key: string]: number}] => {
	let tallyVotes: ballot[] = [];
	let summaryStats: {[key: string]: number} = {};

    tests.forEach(([statName, statTest]) => {
      summaryStats[statName] = 0;
    })
    summaryStats['nTallyVotes'] = 0;

    data.forEach(ballot => {
      // using a classic loop so that I can return out of it
      for(let i = 0; i < tests.length; i++){
        let [statName, statTest] = tests[i]; 
        if(statTest(ballot)){
          summaryStats[statName] = (summaryStats[statName] ?? 0)+1;
          return;
        }
      }
      summaryStats.nTallyVotes++;
	  tallyVotes.push(ballot)
    })

    return [tallyVotes, summaryStats];
}

/*export const totalScoreComparator = (criteria: keyof totalScore, a: totalScore, b: totalScore): number | undefined => {
  if(a[criteria] === undefined) return undefined;
  if(b[criteria] === undefined) return undefined;
  if((a[criteria]) > (b[criteria])) return -1;
  if((a[criteria]) < (b[criteria])) return 1;
  return undefined;
}*/

export const getInitialData = <SummaryType,>(
	allVotes: ballot[],
  candidates: string[],
  randomTiebreakOrder: number[],
  methodType: 'cardinal' | 'orindal',
  statTests: StatTestPair[],
): [ballot[], SummaryType] => {
	// Filter Ballots
	const [tallyVotes, summaryStats] = filterInitialVotes(allVotes, statTests);

	// Initialize randomTiebreakOrder structure
	if (randomTiebreakOrder.length < candidates.length) {
		randomTiebreakOrder = candidates.map((c,index) => index)
	}

  // Matrix for voter preferences
  const preferenceMatrix: number[][] = candidates.map((_,i) => 
    candidates.map((_,j) =>
      // count the number of votes with i > j
      tallyVotes.reduce((n, vote) => n + (methodType == 'cardinal'?
        // Cardinal systems: vote goes to the candinate with the higher number
        (vote[i] > vote[j])? 1 : 0
      :
        // Orindal systems: vote goes to the candinate with the smaller rank
        (vote[i] < vote[j])? 1 : 0
      ), 0)
    )
  )

  // Matrix for voter preferences
  const pairwiseMatrix: number[][] = candidates.map((_,i) => 
    // count if more voters prefer i to j
    candidates.map((_,j) => (preferenceMatrix[i][j] > preferenceMatrix[j][i])? 1 : 0)
  )

  // Totaled score measures for each candidate
  const totalScores: totalScore[] = candidates.map((_,candidateIndex) => ({
    index: candidateIndex,
    score: tallyVotes.reduce(
      (score, vote) => score + vote[candidateIndex],
      0
    ),
  }));

	// Sort totalScores
  const candidatesWithIndexes: candidate[] = candidates.map((candidate, index) => ({ index: index, name: candidate, tieBreakOrder: randomTiebreakOrder[index] }))
  sortTotalScores(totalScores, candidatesWithIndexes);

  return [
		tallyVotes, 
		{
			candidates: candidates.map((candidate, index) => 
				({ index: index, name: candidate, tieBreakOrder: randomTiebreakOrder[index] })
			),
			totalScores,
			preferenceMatrix,
			pairwiseMatrix,
			...summaryStats,
		} as SummaryType
	]
}

export const runBlocTabulator = <ResultsType extends genericResults, SummaryType extends genericSummaryData,>(
	results: ResultsType,
	nWinners: number,
	singleWinnerCallback: (scoresLeft: totalScore[], summaryData: SummaryType) => roundResults
) => {
  let scoresLeft = [...results.summaryData.totalScores];

  for(let w = 0; w < nWinners; w++){
    let roundResults = singleWinnerCallback(scoresLeft, results.summaryData as SummaryType);

    results.elected.push(...roundResults.winners);
    results.roundResults.push(roundResults);

    // remove winner for next round
    scoresLeft = scoresLeft.filter(totalScore => totalScore.index != roundResults.winners[0].index)

    // only save the tie breaker info if we're in the final round
    if(w == nWinners-1){
      results.tied = roundResults.tied; 
      results.tieBreakType = roundResults.tieBreakType; // only save the tie breaker info if we're in the final round
    }
  }

  results.other = scoresLeft.map(s => results.summaryData.candidates[s.index]); // remaining candidates in sortedScores

  return results
}


//{
//    // Initialize arrays
//    const scores: ballot[] = [];
//    const validVotes: voter[] = [];
//    let underVotes: number = 0;
//    const invalidVotes: voter[]  = [];
//    // Parse each row of data into voter, undervote, and score arrays
//    data.forEach((row, n) => {
//        const voter: voter = { csvRow: n + 1 };
//        const ballotValidity = validityCheck(row)
//        if (!ballotValidity.isValid) {
//            invalidVotes.push(voter)
//        }
//        else if (ballotValidity.isUnderVote) {
//            underVotes += 1
//        }
//        else {
//            scores.push(row)
//            validVotes.push(voter);
//        }
//    });
//    return {
//        scores,
//        invalidVotes,
//        underVotes,
//        validVotes
//    };
//}
