const deptAdminRoutes = require('./routes/deptAdminRoutes');

deptAdminRoutes.stack.forEach(layer => {
  if (layer.route) {
    console.log(`${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`);
  }
});
