// Enveloppe une route asynchrone pour transmettre automatiquement les erreurs
// à Express (évite d'écrire un try/catch dans chaque route).
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
