require('dotenv').config();
const mongoClient=require('mongodb').MongoClient
const state={
    db:null
}
module.exports.connect=function(done){
    const url = process.env.MONGODB_URL;
    const dbname = process.env.DB_NAME;
    mongoClient.connect(url).then(client=>{
        state.db=client.db(dbname);
        console.log("database connected successfully");
        if(typeof done==='function')
        done();
    }).catch(err=>{
        if(typeof done==='function') done(err);
    });
};

module.exports.get = function () {
    return state.db
};
