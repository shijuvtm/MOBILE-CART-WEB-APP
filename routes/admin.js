var express = require('express');
var router = express.Router();
const adminHelper = require('../helpers/admin-helpers');
var productHelper = require('../helpers/product-helpers');
const productHelpers = require('../helpers/product-helpers');
const jwt = require('jsonwebtoken');

// Middleware: prefer session, otherwise verify JWT. Redirects to /admin/adminLogin on failure.
function verifyAdminLogin(req, res, next) {
  if (req.session?.adminLoggedIn) {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    const token =
      req.cookies?.token ||
      (authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null);

    if (!token) {
      return res.redirect('/admin/adminLogin');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.role !== 'admin') {
      return res.redirect('/admin/adminLogin');
    }

    // Sync session
    req.session.adminLoggedIn = true;
    req.session.admin = payload;
    req.admin = payload;

    next();
  } catch (err) {
    console.error('Admin JWT verify error:', err);
    res.redirect('/admin/adminLogin');
  }
}
/* GET users listing. */
router.get('/', verifyAdminLogin, function(req, res, next) {
  productHelpers.getAllProducts().then((products)=>{
    console.log(products)
    res.render('admin/view-products',{admin:true,products})
  }).catch(err => {
    console.error('Error fetching products:', err);
    next(err);
  });
});

router.get('/adminSignup',(req,res) => {
  res.render('admin/adminSignup');
});

router.post('/adminSignup', (req, res) => {
  adminHelper.doadminSignup(req.body)
    .then(() => {
      res.redirect('/admin/adminLogin');
    })
    .catch(err => {
      console.error('Signup error:', err);
      res.render('admin/adminSignup', {
        signupError: err.message || 'Something went wrong',
        formData: req.body
      });
    });
});

router.get('/adminLogin',(req,res)=>{
  res.render('admin/adminLogin');
});
router.post('/adminLogin', async (req, res) => {
  try {
    const response1 = await adminHelper.doadminLogin(req.body);

    if (!response1.status || !response1.admin) {
      return res.render('admin/adminLogin', {
        loginError: 'Invalid admin credentials'
      });
    }

    req.session.adminLoggedIn = true;
    req.session.admin = response1.admin;

    const token = jwt.sign(
      {
        id: response1.admin._id.toString(),
        role: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax'
    });

    res.redirect('/admin/');
  } catch (err) {
    console.error('Login error:', err);
    res.render('admin/adminLogin', {
      loginError: 'Something went wrong'
    });
  }
});
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
    }

    res.clearCookie('token'); // remove JWT
    res.redirect('/admin/adminLogin');
  });
});

router.get('/add-product', verifyAdminLogin, function(req,res) {
  res.render('admin/add-product');
});

router.post('/add-product', verifyAdminLogin, (req, res) => {
  console.log(req.body);
  console.log(req.files?.Image);

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
  }).catch(err => {
    console.error('Delete product error:', err);
    res.redirect('/admin/');
  });
});

router.get('/edit-product/:id', verifyAdminLogin, async(req,res)=>{
  try {
    let product=await productHelpers.getProductsDetails(req.params.id);
    console.log(product);
    res.render('admin/edit-product',{product});
  } catch (err) {
    console.error('Edit product fetch error:', err);
    res.redirect('/admin/');
  }
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
  }).catch(err => {
    console.error('Update product error:', err);
    res.redirect('/admin/');
  });
});

router.get('/all-users', verifyAdminLogin, async (req, res) => {
  try {
    let users = await adminHelper.getAllUsers();
    res.render('admin/all-users', { users });
  } catch (error) {
    console.log("Error fetching users:", error);
    res.redirect('/admin/');
  }
});

router.get('/all-orders', verifyAdminLogin, async (req, res) => {
  try {
    let orders = await adminHelper.getAllOrders();
    res.render('admin/all-orders', { orders });
  } catch (error) {
    console.log("Error fetching orders:", error);
    res.redirect('/admin/');
  }
});

module.exports = router;
