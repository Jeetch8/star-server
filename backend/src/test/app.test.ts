require('dotenv').config();
const request = require('supertest');
import makeApp from '../app';

const app = makeApp()

const testInputs = require('./testInputs')

// Mocks databases for testing app
// Uses mocks defined in ./../Models/__Mocks__/
jest.mock('./../Models/Ballots')
jest.mock('./../Models/Elections')
jest.mock('./../Models/ElectionRolls')

afterEach(() => {
    jest.clearAllMocks();
});

describe("Post Election", () => {

    describe("Election data provided", () => {
        test("responds with 200 status", async () => {
            const response = await request(app)
                .post('/API/Elections')
                .set('Cookie', ['id_token=' + testInputs.user1token])
                .set('Accept', 'application/json')
                .send({ Election: testInputs.Election1, VoterIDList: [] })

            expect(response.statusCode).toBe(200)
        })
        test("Get responds with 200 status", async () => {
            const response = await request(app)
                .get('/API/Election/0')
                .set('Cookie', ['id_token=' + testInputs.user1token])
                .set('Accept', 'application/json')
            // console.log(response)
            expect(response.statusCode).toBe(200)
        })
    })
    describe("Election not provided/incorrect format", () => {
        test("responds with 400 status", async () => {
            const response = await request(app)
                .post('/API/Elections')
                .set('Cookie', ['id_token=' + testInputs.user1token])
                .set('Accept', 'application/json')
                .send({ VoterIDList: [] })

            expect(response.statusCode).toBe(400)
        })
        // TODO: Add validation in API inputs
        // test("responds with 400 status", async () => {
        //     const response = await request(app)
        //         .post('/API/Elections')
        //         .set('Cookie', ['id_token=' + testInputs.user1token])
        //         .set('Accept', 'application/json')
        //         .send({ Election: testInputs.IncompleteElection, VoterIDList: [] })

        //     expect(response.statusCode).toBe(400)
        // })

    })
    describe("User is not logged in", () => {
        test("responds with 400 status", async () => {
            const response = await request(app)
                .post('/API/Elections')
                .set('Accept', 'application/json')
                .send({ Election: testInputs.Election1, VoterIDList: [] })

            expect(response.statusCode).toBe(400)
        })

    })
})



describe("Edit Election", () => {
    // TODO: I'm making a lot of calls to add elections within the edit election tests
    //       Ideally I'd like to setup the mocks without relying on the other apis, but I couldn't figure out a way to do that
    const setupInitialElection = async () => {
        const response = await request(app)
            .post('/API/Elections')
            .set('Cookie', ['id_token=' + testInputs.user1token])
            .set('Accept', 'application/json')
            .send({ Election: testInputs.Election1, VoterIDList: [] })
            .expect('Content-Type', /json/)
            const responseObject = JSON.parse(response.body)
            return responseObject.election.election_id
    }

    describe("Election data provided", () => {
        test("responds with 200 status", async () => {
            const ID = await setupInitialElection()

            const response = await request(app)
                .post(`/API/Election/${ID}/edit`)
                .set('Cookie', ['id_token=' + testInputs.user1token])
                .set('Accept', 'application/json')
                .send({ Election: testInputs.Election1, VoterIDList: [] })
            expect(response.statusCode).toBe(200)
        })
    })
    describe("Election not provided/incorrect format", () => {
        test("responds with 400 status", async () => {
            const ID = await setupInitialElection()

            const response = await request(app)
                .post(`/API/Election/${ID}/edit`)
                .set('Cookie', ['id_token=' + testInputs.user1token])
                .set('Accept', 'application/json')
                .send({ VoterIDList: [] })
            expect(response.statusCode).toBe(400)
        })
    })
    describe("User is not logged in", () => {
        test("responds with 400 status", async () => {
            const ID = await setupInitialElection()

            const response = await request(app)
                .post(`/API/Election/${ID}/edit`)
                .set('Accept', 'application/json')
                .send({ Election: testInputs.Election1, VoterIDList: [] })

            expect(response.statusCode).toBe(400)
        })
    })
    describe("User is not owner", () => {
        test("responds with 400 status", async () => {
            const ID = await setupInitialElection()

            const response = await request(app)
                .post(`/API/Election/${ID}/edit`)
                .set('Cookie', ['id_token=' + testInputs.user2token])
                .set('Accept', 'application/json')
                .send({ Election: testInputs.Election1, VoterIDList: [] })

            expect(response.statusCode).toBe(400)
        })
    })
    describe("User edits election", () => {
        test("edits title", async () => {
            const ID = await setupInitialElection()

            var election1Copy = {...testInputs.Election1}
            var newTitle = `${election1Copy.title} - Edited`
            election1Copy.title = newTitle

            const response = await request(app)
                .post(`/API/Election/${ID}/edit`)
                .set('Cookie', ['id_token=' + testInputs.user1token])
                .set('Accept', 'application/json')
                .send({ Election: election1Copy, VoterIDList: [] })

            // expect(ElectionsDB.elections[election1Copy.election_id].title).toBe(newTitle)
            expect(response.statusCode).toBe(200)
        })
        test("edits roll type", async () => {
            // I'm testing roll type specifically to make sure nested fields are applied correctly

            const ID = await setupInitialElection()

            // I wanted to use structuredClone here, but I had trouble getting it to work with jest :'(
            var election1Copy = {...testInputs.Election1, settings: {...testInputs.Election1.settings}}
            var newRollType = 'Some Other Roll Type'
            election1Copy.settings.election_roll_type = newRollType

            const response = await request(app)
                .post(`/API/Election/${ID}/edit`)
                .set('Cookie', ['id_token=' + testInputs.user1token])
                .set('Accept', 'application/json')
                .send({ Election: election1Copy, VoterIDList: [] })

            // TODO: I couldn't figure out how to make this work, it kept saying that ElectionsDB.mock was undefined?
            // expect(ElectionsDB.mock.instances[0].elections[election1Copy.election_id].settings.election_roll_type).toBe(newRollType)
            expect(response.statusCode).toBe(200)
        })
        test("edits voter ids", async () => {
            // TODO
        })
    })
})

describe("Email Roll", () => {
    beforeAll(() => {
        jest.clearAllMocks();
    });
    var ID = 0;
    test("Create election, responds 200", async () => {
        const response = await request(app)
            .post('/API/Elections')
            .set('Cookie', ['id_token=' + testInputs.user1token])
            .set('Accept', 'application/json')
            .send({ Election: testInputs.EmailRollElection, VoterIDList: testInputs.EmailRoll })
        // console.log(response.body)
        expect(response.statusCode).toBe(200)
        const responseObject = JSON.parse(response.body)
        ID = responseObject.election.election_id
    })
    test("Get voter auth, is authorized and hasn't voted", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/ballot`)
            .set('Cookie', ['id_token=' + testInputs.user1token])
            .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body.voterAuth.authorized_voter).toBe(true)
        expect(response.body.voterAuth.has_voted).toBe(false)
    })
    test("Authorized voter submits ballot", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/vote`)
            .set('Cookie', ['id_token=' + testInputs.user1token])
            .set('Accept', 'application/json')
            .send({ ballot: testInputs.Ballot1 })
        // console.log(response.body)
        expect(response.statusCode).toBe(200)
    })
    test("Get voter auth, is authorized and has voted", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/ballot`)
            .set('Cookie', ['id_token=' + testInputs.user1token])
            .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body.voterAuth.authorized_voter).toBe(true)
        expect(response.body.voterAuth.has_voted).toBe(true)
    })
    test("Authorized voter re-submits ballot", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/vote`)
            .set('Cookie', ['id_token=' + testInputs.user1token])
            .set('Accept', 'application/json')
            .send({ ballot: testInputs.Ballot1 })
        // console.log(response)
        expect(response.statusCode).toBe(400)
    })
    test("Get voter auth, isn't authorized and hasn't voted", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/ballot`)
            .set('Cookie', ['id_token=' + testInputs.user3token])
            .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body.voterAuth.authorized_voter).toBe(false)
        expect(response.body.voterAuth.has_voted).toBe(false)
    })
    test("Unauthorized voter submits ballot", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/vote`)
            .set('Cookie', ['id_token=' + testInputs.user3token])
            .set('Accept', 'application/json')
            .send({ ballot: testInputs.Ballot1 })
        // console.log(response)
        expect(response.statusCode).toBe(400)
    })
})

describe("ID Roll", () => {
    beforeAll(() => {
        jest.resetAllMocks();
    });
    var ID = 0;
    test("Create election, responds 200", async () => {
        const response = await request(app)
            .post('/API/Elections')
            .set('Cookie', ['id_token=' + testInputs.user1token])
            .set('Accept', 'application/json')
            .send({ Election: testInputs.IDRollElection, VoterIDList: testInputs.IDRoll })
        expect(response.statusCode).toBe(200)
        const responseObject = JSON.parse(response.body)
        ID = responseObject.election.election_id
    })
    test("Get voter auth, is authorized and hasn't voted", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/ballot`)
            .set('Cookie', ['id_token=' + testInputs.user1token + '; voter_id=' + testInputs.IDRoll[0]])
            .set('Accept', 'application/json')
            .send({})
        expect(response.statusCode).toBe(200)
        expect(response.body.voterAuth.authorized_voter).toBe(true)
        expect(response.body.voterAuth.has_voted).toBe(false)
    })
    test("Authorized voter submits ballot", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/vote`)
            .set('Cookie', ['id_token=' + testInputs.user1token + '; voter_id=' + testInputs.IDRoll[0]])
            .set('Accept', 'application/json')
            .send({ ballot: testInputs.Ballot2})
        // console.log(response)
        expect(response.statusCode).toBe(200)
    })
    test("Get voter auth, is authorized and has voted", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/ballot`)
            .set('Cookie', ['id_token=' + testInputs.user1token + '; voter_id=' + testInputs.IDRoll[0]])
            .set('Accept', 'application/json')
            .send({})
        expect(response.statusCode).toBe(200)
        expect(response.body.voterAuth.authorized_voter).toBe(true)
        expect(response.body.voterAuth.has_voted).toBe(true)
    })
    test("Authorized voter re-submits ballot", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/vote`)
            .set('Cookie', ['id_token=' + testInputs.user1token + '; voter_id=' + testInputs.IDRoll[0]])
            .set('Accept', 'application/json')
            .send({ ballot: testInputs.Ballot2})
        // console.log(response)
        expect(response.statusCode).toBe(400)
    })
    test("Get voter auth, isn't authorized and hasn't voted", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/ballot`)
            .set('Cookie', ['id_token=' + testInputs.user3token + '; voter_id=' + 'FakeVoterID'])
            .set('Accept', 'application/json')
            .send({})
        expect(response.statusCode).toBe(200)
        expect(response.body.voterAuth.authorized_voter).toBe(false)
        expect(response.body.voterAuth.has_voted).toBe(false)
    })
    test("Unauthorized voter submits ballot", async () => {
        const response = await request(app)
            .post(`/API/Election/${ID}/vote`)
            .set('Cookie', ['id_token=' + testInputs.user3token + '; voter_id=' + 'FakeVoterID'])
            .set('Accept', 'application/json')
            .send({ ballot: testInputs.Ballot2})
        // console.log(response)
        expect(response.statusCode).toBe(400)
    })
})