var db = require("../config/connection");
var collection = require("../config/collection");
const bcrypt = require("bcryptjs");
const { request,response } = require("../app");
const { ObjectId } = require("mongodb");

module.exports={
   doadminSignup:(adminData)=>{
     return new Promise(async (resolve,reject)=> {
      try {
        if(!adminData.password){
           return reject(new Error("password is required"));
       }

     adminData.password = await bcrypt.hash(adminData.password,10);
     
     db.get().collection(collection.ADMIN_COLLECTION).insertOne(adminData).then((data)=>{
     resolve(data.insertedId);
     }).catch((err)=> reject(err));
} catch (err) {
  reject(err);
}
});
},
doadminLogin: (adminData) => {
  return new Promise(async (resolve, reject) => {
    try {
      let admin = await db
        .get()
        .collection(collection.ADMIN_COLLECTION)
        .findOne({ email: adminData.email });
      
      if (admin) {
        const passwordMatch = await bcrypt.compare(adminData.password, admin.password);
        if (passwordMatch) {
          console.log("login success");
          resolve({
            admin: admin,
            status: true
          });
        } else {
          console.log("login failed - incorrect password");
          resolve({ status: false });
        }
      } else {
        console.log("login failed - admin not found");
        resolve({ status: false });
      }
    } catch (error) {
      console.log("login error:", error);
      reject(error);
    }
  });
},
getAllUsers: () => {
  return new Promise(async (resolve, reject) => {
    try {
      let users = await db
        .get()
        .collection(collection.USER_COLLECTION)
        .find({})
        .toArray();

      resolve(users);
    } catch (error) {
      reject(error);
    }
  });
},
getAllOrders: () => {
  return new Promise(async (resolve, reject) => {
    try {
      let orders = await db
        .get()
        .collection(collection.ORDER_COLLECTION)
        .aggregate([
          {
            $lookup: {
              from: collection.USER_COLLECTION,
              localField: 'userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $unwind: '$user'
          }
        ])
        .toArray();

      resolve(orders);

    } catch (error) {
      reject(error);
    }
  });
}
}
