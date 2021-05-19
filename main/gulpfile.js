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
  config.devtool = 'source-map';
  return gulp.src('src/extension.ts')
    .pipe(webpack(config))
    .pipe(gulp.dest('dist/'));
});

gulp.task('images', () => {
  return gulp.src('src/images/**/*')
    .pipe(gulp.dest('dist/images'));
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
  gulp.watch('src/images/**/*', gulp.series('images'));
  gulp.watch('node_modules/@halon/json-schemas/*.schema.json', gulp.series('json-schemas'));
});

gulp.task('production', gulp.series('clean', gulp.parallel('webpack-production', 'images', 'json-schemas', 'protobuf-schemas')));
gulp.task('development', gulp.series('clean', gulp.parallel('webpack-development', 'images', 'json-schemas', 'protobuf-schemas')));