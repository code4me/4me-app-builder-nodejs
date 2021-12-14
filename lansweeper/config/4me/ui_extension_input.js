var $ = ITRP.$;
var $extension = $(this);

var $client_id = $extension.find('#client_id');
var $client_secret = $extension.find('#client_secret');
var $connection_status = $extension.find('#connection_status');

ITRP.hooks.register('after-prefill', function() {
  $extension.find('#last_synced_section').addClass('hide');

  var connection_status = $connection_status.val();

  if (connection_status === 'pending_client_credentials') {
    $extension.find('.step-client-credentials').removeClass('hide');
    var nextStep = function() {
      var step = 'pending_client_credentials';
      if (!String.isBlank($client_id.val()) && !String.isBlank($client_secret.val())) {
        step = 'pending_callback_url';
      }
      $connection_status.val(step);
    };
    $client_id.on('change', nextStep);
    $client_secret.on('change', nextStep);
  }

  if (connection_status === 'pending_authorization') {
    $extension.find('.step-authorize').removeClass('hide');
  }
});