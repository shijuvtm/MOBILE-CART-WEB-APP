var express = require('express');
var router = express.Router();
const adminHelper = require('../helpers/admin-helpers');
var productHelper = require('../helpers/product-helpers');
const productHelpers = require('../helpers/product-helpers');



function verifyAdminLogin(req, res, next) {
  if (req.session && req.session.adminLoggedIn) {
    next();
  } else {
    res.redirect('/admin/adminLogin');
  }
}

/* GET users listing. */
router.get('/', verifyAdminLogin, function(req, res, next) {
  productHelpers.getAllProducts().then((products)=>{
    console.log(products)
    res.render('admin/view-products',{admin:true,products})
  });
});

router.get('/adminSignup',(req,res) => {
  res.render('admin/adminSignup');
});

router.post('/adminSignup', (req,res) => {
  adminHelper.doadminSignup(req.body).then((response)=>{
    console.log(response);
    res.redirect('/admin/adminLogin');
  });
});

router.get('/adminLogin',(req,res)=>{
  res.render('admin/adminLogin');
});

router.post('/adminLogin', (req, res) => {
  adminHelper.doadminLogin(req.body).then((response1) => {
    if (response1.status) {
      req.session.adminLoggedIn = true;
      req.session.admin = response1.admin;
      res.redirect('/admin/');
    } else {
      console.log("admin-error");
      res.redirect('/admin/adminLogin');
    }
  });
});

router.get('/logout',(req,res)=>{
  req.session.adminLoggedIn = false;
  req.session.admin = null;
  res.redirect('/admin/adminLogin');
});

router.get('/add-product', verifyAdminLogin, function(req,res) {
  res.render('admin/add-product');
});

router.post('/add-product', verifyAdminLogin, (req, res) => {
  console.log(req.body);
  console.log(req.files.Image);

  productHelper.addProduct(req.body, (id) => {
    let image = req.files.Image;
    var path = require('path');

    var imagepath = path.join(__dirname, '../public/product-images', id + '.jpg');
    console.log("Saving image to " + imagepath);
    image.mv(imagepath, (err) => {
      if (err) {
        console.log('file upload error:', err);
        return res.status(500).send('File upload failed');
      }
      console.log("image successfully saved");
      res.render("admin/add-product");
    });
  });
});

router.get('/delete-product/:id', verifyAdminLogin, (req,res)=>{
  let proId=req.params.id;
  console.log(proId);
  productHelper.deleteProduct(proId).then((response)=>{
    res.redirect('/admin/');
  });
});

router.get('/edit-product/:id', verifyAdminLogin, async(req,res)=>{
  let product=await productHelpers.getProductsDetails(req.params.id);
  console.log(product);
  res.render('admin/edit-product',{product});
});

router.post('/edit-product/:id', verifyAdminLogin, (req,res)=>{
  productHelpers.updateProduct(req.params.id,req.body).then(()=>{
    let id=req.params.id;
    if(req.files && req.files.Image) {
      var image=req.files.Image;
      var path = require('path');
      var imagepath= path.join(__dirname,'../public/product-images', id + '.jpg');  

      console.log("Saving image to " + imagepath);
      image.mv(imagepath);
    }
    res.redirect('/admin/');
  });
});

router.get('/all-users', verifyAdminLogin, async (req, res) => {
  try {
    let users = await adminHelper.getAllUsers();
    res.render('admin/all-users', { users });
  } catch (error) {
    console.log("Error fetching users:", error);
  }
});

router.get('/all-orders', verifyAdminLogin, async (req, res) => {
  try {
    let orders = await adminHelper.getAllOrders();
    res.render('admin/all-orders', { orders });
  } catch (error) {
    console.log("Error fetching orders:", error);
  }
});

module.exports = router;
