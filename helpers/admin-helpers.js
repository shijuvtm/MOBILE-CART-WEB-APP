var db = require("../config/connection");
var collection = require("../config/collection");
const bcrypt = require("bcryptjs");
const { request,response } = require("../app");
const { ObjectId } = require("mongodb");

module.exports={

doadminSignup: async (userData) => {
  if (!userData.password) {
    throw new Error("Password is required");
  }

  // normalize email
  userData.Email = userData.Email.toLowerCase();

  const existingAdmin = await db
    .get()
    .collection(collection.ADMIN_COLLECTION)
    .findOne({ Email: userData.Email });

  if (existingAdmin) {
    throw new Error("Account already exists");
  }

  userData.password = await bcrypt.hash(userData.password, 10);

  const adminData = {
    Email: userData.Email,
    password: userData.password,
    role: 'admin',
    createdAt: new Date()
  };

  const result = await db
    .get()
    .collection(collection.ADMIN_COLLECTION)
    .insertOne(adminData);

  return { status: true, admin: adminData, id: result.insertedId };
},
doadminLogin: async (adminData) => {
  const admin = await db
    .get()
    .collection(collection.ADMIN_COLLECTION)
    .findOne({ Email: adminData.Email.toLowerCase() });

  if (!admin) {
    return { status: false };
  }

  const status = await bcrypt.compare(
    adminData.password,
    admin.password
  );

  if (status) {
    return { status: true, admin };
  } else {
    return { status: false };
  }
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
