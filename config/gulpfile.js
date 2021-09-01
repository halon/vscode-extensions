const gulp = require('gulp');
const del = require('del');

gulp.task('clean', () => {
  return del([
    'dist/**/*'
  ]);
});

gulp.task('json-schemas', () => {
  return gulp.src('node_modules/@halon/json-schemas/**/*.schema.json')
    .pipe(gulp.dest('dist/json-schemas'));
});

gulp.task('default', gulp.series('clean', 'json-schemas'));