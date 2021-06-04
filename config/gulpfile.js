const gulp = require('gulp');
const del = require('del');
const webpack = require('webpack-stream');

gulp.task('clean', () => {
  return del([
    'dist/**/*'
  ]);
});

gulp.task('webpack-production', function() {
  let config = require('./webpack.config.js');
  config.mode = 'production';
  return gulp.src('src/extension.ts')
    .pipe(webpack(config))
    .pipe(gulp.dest('dist/'));
});

gulp.task('webpack-development', function() {
  let config = require('./webpack.config.js');
  config.mode = 'development';
  config.devtool = 'nosources-source-map';
  return gulp.src('src/extension.ts')
    .pipe(webpack(config))
    .pipe(gulp.dest('dist/'));
});

gulp.task('json-schemas', () => {
  return gulp.src('node_modules/@halon/json-schemas/*.schema.json')
    .pipe(gulp.dest('dist/json-schemas'));
});

gulp.task('protobuf-schemas', () => {
  return gulp.src('node_modules/@halon/protobuf-schemas/*.proto')
    .pipe(gulp.dest('dist/protobuf-schemas'));
});

gulp.task('watch', () => {
  gulp.watch(['src/**/*.ts', 'src/**/*.json'], gulp.series('webpack-development'));
  gulp.watch('node_modules/@halon/json-schemas/*.schema.json', gulp.series('json-schemas'));
  gulp.watch('node_modules/@halon/protobuf-schemas/*.proto', gulp.series('protobuf-schemas'));
});

gulp.task('production', gulp.series('clean', gulp.parallel('webpack-production', 'json-schemas', 'protobuf-schemas')));
gulp.task('development', gulp.series('clean', gulp.parallel('webpack-development', 'json-schemas', 'protobuf-schemas')));