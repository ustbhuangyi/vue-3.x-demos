const fs = require('fs')
const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'development',

  entry: fs.readdirSync(__dirname).reduce((entries, dir) => {
    const fullDir = path.join(__dirname, dir)
    const entry = path.join(fullDir, 'app.js')
    if (fs.statSync(fullDir).isDirectory() && fs.existsSync(entry)) {
      entries[dir] = ['webpack-hot-middleware/client', entry]
    }
    return entries
  }, {}),

  /**
   * 根据不同的目录名称，打包生成目标 js，名称和目录名一致
   */
  output: {
    path: path.join(__dirname, '__build__'),
    filename: '[name].js',
    publicPath: '/__build__/'
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      },
      {
        test: /\.css$/,
        use: [
          'style-loader', 'css-loader'
        ]
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg)$/,
        use: [{
          loader: 'url-loader?limit=100000'
        }]
      }
    ]
  },

  resolve: {
    extensions: ['.js'],
    alias: genAlias()
  },

  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin()
  ]
}

function genAlias () {
  const alias = {
    '@vue/vue': path.resolve(__dirname, './packages/vue/dist/vue.esm-browser.js')
  }
  const runtimePackageNames = ['reactivity', 'runtime-core', 'runtime-dom']
  runtimePackageNames.forEach((name) => {
    alias[`@vue/${name}`] = path.resolve(__dirname, `./packages/${name}/dist/${name}.esm-bundler.js`)
  })
  const compilePackageNames = ['compiler-core', 'compiler-dom']
  compilePackageNames.forEach((name) => {
    alias[`@vue/${name}`] = path.resolve(__dirname, `./packages/${name}/dist/${name}.cjs.js`)
  })
  return alias
}
