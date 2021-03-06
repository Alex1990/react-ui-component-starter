const path = require('path');
const parseGithubUrl = require('parse-github-url');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const util = require('./util');

const packageName = process.env.npm_package_name;
const packageVersion = process.env.npm_package_version;
const packageRepositoryUrl = process.env.npm_package_repository_url;

const root = process.cwd();

module.exports = function (options) {
  const {
    entry,
    exampleEntry,
    env,
    task,
  } = options;

  const config = {
    entry,
    context: root,
    resolve: {
      extensions: ['.js', '.jsx'],
    },
    node: {
      Buffer: false,
    },
    plugins: [],
    module: {
      rules: [],
    },
  };

  if (task === 'examples') {
    if (env.NODE_ENV === 'production') {
      config.output = {
        filename: '[name]-[hash:16].js',
        path: path.join(root, `build/${packageName}`),
        publicPath: `/${packageName}/`,
      };
    } else {
      config.output = {
        filename: '[name].js',
        path: path.join(root, 'build'),
        publicPath: '/',
      };
    }
  } else {
    config.output = {
      filename: `${packageName}.js`,
      path: path.join(root, 'dist'),
      // Todo: can this be customized?
      library: util.dashToUpperCamelCase(packageName),
      libraryTarget: 'umd',
    };
  }

  if (env.NODE_ENV === 'production') {
    if (task !== 'examples') {
      config.externals = {
        react: {
          root: 'React',
          commonjs: 'react',
          commonjs2: 'react',
          amd: 'react',
        },
        'react-dom': {
          root: 'ReactDOM',
          commonjs: 'react-dom',
          commonjs2: 'react-dom',
          amd: 'react-dom',
        },
      };
    }
  }

  if (env.NODE_ENV === 'production') {
    config.devtool = 'source-map';
  } else {
    config.devtool = 'eval-source-map';
  }

  /**
   * Plugins
   */
  const repo = parseGithubUrl(packageRepositoryUrl);
  const definedVar = {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    packageName: JSON.stringify(packageName),
    packageVersion: JSON.stringify(packageVersion),
    repository: JSON.stringify(repo.repo ? `https://github.com/${repo.repo}` : ''),
  };

  if (task === 'examples') {
    const re = /^([^\/]+)\/index$/;
    const exampleDirs = Object.keys(exampleEntry)
      .map(v => v.match(re)[1])
      .sort();
    definedVar.exampleDirs = JSON.stringify(exampleDirs);
  }

  config.plugins.push(
    new webpack.DefinePlugin(definedVar),
    new ProgressBarPlugin()
  );

  if (env.NODE_ENV === 'production') {
    let cssFilename;

    if (task === 'examples') {
      config.plugins.push(
        new webpack.optimize.UglifyJsPlugin({
          sourceMap: true,
          compress: {
            warnings: false,
          },
        })
      );
      cssFilename =  '[name]-[contenthash:16].css';
    } else {
      cssFilename = `${packageName}.css`;
    }
    config.plugins.push(new ExtractTextPlugin(cssFilename));
  } else {
    config.plugins.push(
      new webpack.HotModuleReplacementPlugin(),
      new webpack.NamedModulesPlugin()
    );
  }

  if (task === 'examples') {
    const examplesHtmls = [];

    for (const entryName in entry) {
      examplesHtmls.push(new HtmlWebpackPlugin({
        chunks: [entryName],
        filename: entryName + '.html',
        template: 'examples/entry_template.html',
      }));
    }
    config.plugins.push(...examplesHtmls);
  }


  /**
   * JavaScript/React/Babel loader
   */
  config.module.rules.push({
    test: /\.jsx?$/,
    exclude: /node_modules/,
    use: [
      {
        loader: 'babel-loader',
        options: {
          compact: false,
        },
      },
    ],
  });

  /**
   * Markdown
   */
  config.module.rules.push({
    test: /\.md$/,
    use: [
      {
        loader: 'html-loader',
      },
      {
        loader: 'markdown-loader',
        options: {
        },
      },
    ],
  });

  /**
   * CSS/LESS/SASS/SCSS/PostCSS loader
   */
  let extractCSS;

  if (env.NODE_ENV === 'production') {
    extractCSS = loaders => ExtractTextPlugin.extract({
      fallback: 'style-loader',
      use: loaders
    });
  } else {
    extractCSS = loaders => ['style-loader', ...loaders];
  }

  config.module.rules.push(
    {
      test: /\.css$/,
      use: extractCSS([
        {
          loader: 'css-loader',
          options: {
            sourceMap: true,
            minimize: false,
            importLoaders: 0,
          },
        },
        {
          loader: "postcss-loader",
        },
      ]),
    },
    {
      test: /\.less$/,
      use: extractCSS([
        {
          loader: 'css-loader',
          options: {
            sourceMap: true,
          },
        },
        {
          loader: "postcss-loader",
        },
        {
          loader: 'less-loader',
          options: {
            sourceMap: true,
          },
        },
      ]),
    },
    {
      test: /\.(sass|scss)$/,
      use: extractCSS([
        {
          loader: 'css-loader',
          options: {
            sourceMap: true,
          },
        },
        {
          loader: "postcss-loader",
        },
        {
          loader: 'sass-loader',
          options: {
            sourceMap: true,
            outputStyle: 'expanded',
          },
        },
      ]),
    },
    {
      test: /\.styl$/,
      use: extractCSS([
        {
          loader: 'css-loader',
          options: {
            sourceMap: true,
          },
        },
        {
          loader: "postcss-loader",
        },
        {
          loader: 'stylus-loader',
          options: {
            sourceMap: true,
          },
        },
      ]),
    }
  );

  /**
   * Images: png/jpg/gif
   */
  config.module.rules.push(
    {
      test: /\.(png|jpg|gif)$/,
      use: [
        {
          loader: 'url-loader',
          options: {
            limit: 8192,
          },
        },
      ],
    }
  );

  /**
   * Fonts: svg/eot/wott/wott2/otf/ttf
   */
  config.module.rules.push(
    {
      test: /\.svg(\?.*)?$/,
      use: [
        {
          loader: 'url-loader',
          options: {
            prefix: 'fonts/',
            name: '[path][name].[ext]',
            limit: 10000,
            mimetype: 'application/svg+xml',
          },
        },
      ],
    },
    {
      test: /\.eot(\?.*)?$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            prefix: 'fonts/',
            name: '[path][name].[ext]',
          },
        },
      ],
    },
    {
      test: /\.woff(\?.*)?$/,
      use: [
        {
          loader: 'url-loader',
          options: {
            prefix: 'fonts/',
            name: '[path][name].[ext]',
            limit: 10000,
            mimetype: 'application/font-woff',
          },
        },
      ],
    },
    {
      test: /\.woff2(\?.*)?$/,
      use: [
        {
          loader: 'url-loader',
          options: {
            prefix: 'fonts/',
            name: '[path][name].[ext]',
            limit: 10000,
            mimetype: 'application/font-woff2',
          },
        },
      ],
    },
    {
      test: /\.otf(\?.*)?$/,
      use: [
        {
          loader: 'url-loader',
          options: {
            prefix: 'fonts/',
            name: '[path][name].[ext]',
            limit: 10000,
            mimetype: 'font/opentype',
          },
        },
      ],
    },
    {
      test: /\.ttf(\?.*)?$/,
      use: [
        {
          loader: 'url-loader',
          options: {
            prefix: 'fonts/',
            name: '[path][name].[ext]',
            limit: 10000,
            mimetype: 'application/octet-strea',
          },
        },
      ],
    }
  );

  if (env.NODE_ENV === 'development') {
    config.devServer = {
      compress: true,
      clientLogLevel: 'none',
      contentBase: path.join(__dirname, 'build'),
      hot: true,
      port: 9000,
      quiet: true,
      stats: 'errors-only',
      watchOptions: {
        ignored: /node_modules/,
      },
      overlay: true,
    };
  }

  return config;
};
