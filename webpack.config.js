module.exports = {
    mode: "development",
    devServer: {
      static: "dist",
      open: true
    },
    module: {
        rules: [
            {
                test: /\.(glsl|vs|fs|vert|frag)$/,
                exclude: /node_modules/,
                use: [
                  'raw-loader',
                ]
            }
        ]
    }
  };