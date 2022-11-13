const express = require("express");
const axios = require("axios");
const redis = require("redis");

const app = express();
const port = process.env.PORT || 3000;

let redisClient;
//connect to redis service
(async() => {
    redisClient = redis.createClient();

    redisClient.on("error", (error) => console.error(`Error : ${error}`));

    await redisClient.connect();
})();
// with req.params.species ,retrive the species using the API endpoint and axios
async function fetchApiData(species) {
    const apiResponse = await axios.get(
        `https://www.fishwatch.gov/api/species/${species}`
    );
    console.log("Request sent to the API");
    return apiResponse.data;
}
// middleware,it verify if the is cache set with value 'species' .If yes it send response back without calling API.But if no,it goes next()
async function cacheData(req, res, next) {
    const species = req.params.species;
    let results;
    try {
        const cacheResults = await redisClient.get(species);
        if (cacheResults) {
            results = JSON.parse(cacheResults);
            res.send({
                fromCache: true,
                data: results,
            });
        } else {
            next();
        }
    } catch (error) {
        console.error(error);
        res.status(404);
    }
}
// call the API because there is no cache set up for 'species'
async function getSpeciesData(req, res) {
    const species = req.params.species;
    let results;
    try {
        results = await fetchApiData(species);
        if (results.length === 0) {
            throw "API returned an empty array";
        }
        await redisClient.set(species, JSON.stringify(results), {
            EX: 10,
            NX: true
        })

        res.send({
            fromCache: false,
            data: results,
        });
    } catch (error) {
        console.error(error);
        res.status(404).send("Data unavailable");
    }
}
// get handler zith middleware cacheData and function getSpeciesData
app.get("/fish/:species", cacheData, getSpeciesData);

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});