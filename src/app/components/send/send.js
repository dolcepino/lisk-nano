import './send.less';

const ADDRESS_VALID_RE = '^[0-9]{1,21}[L|l]$';
const AMOUNT_VALID_RE = '^[0-9]+(.[0-9]{1,8})?$';

app.component('send', {
  template: require('./send.pug')(),
  bindings: {
    account: '<',
    passphrase: '<',
  },
  controller: class send {
    constructor($scope, $peers, lsk, success, error, $mdDialog, $q, $rootScope) {
      this.$scope = $scope;
      this.$peers = $peers;
      this.success = success;
      this.error = error;
      this.$mdDialog = $mdDialog;
      this.$q = $q;
      this.$rootScope = $rootScope;

      this.recipient = {
        regexp: ADDRESS_VALID_RE,
      };

      this.amount = {
        regexp: AMOUNT_VALID_RE,
      };

      this.$scope.$watch('$ctrl.amount.value', () => {
        this.amount.raw = lsk.from(this.amount.value) || 0;
      });

      this.$scope.$watch('$ctrl.account.balance', () => {
        this.amount.max = parseFloat(lsk.normalize(this.account.balance)) - 0.1;
      });
    }

    reset() {
      this.recipient.value = '';
      this.amount.value = '';
    }

    promptSecondPassphrase() {
      return this.$q((resolve, reject) => {
        if (this.account.secondSignature) {
          this.$mdDialog.show({
            controllerAs: '$ctrl',
            template: require('./second.pug')(),
            controller: /* @ngInject*/ class second {
              constructor($scope, $mdDialog) {
                this.$mdDialog = $mdDialog;
              }

              ok() {
                this.$mdDialog.hide();
                resolve(this.value);
              }

              cancel() {
                this.$mdDialog.hide();
                reject();
              }
            },
          });
        } else {
          resolve();
        }
      });
    }

    go() {
      this.loading = true;

      this.promptSecondPassphrase()
        .then((secondPassphrase) => {
          this.$peers.active.sendLSKPromise(
            this.recipient.value,
            this.amount.raw,
            this.passphrase,
            secondPassphrase,
          )
          .then(
            (data) => {
              const transaction = {
                id: data.transactionId,
                senderPublicKey: this.account.publicKey,
                senderId: this.account.address,
                recipientId: this.recipient.value,
                amount: this.amount.raw,
                fee: 10000000,
              };
              this.$rootScope.$broadcast('transaction-sent', transaction);
              return this.success.dialog({ text: `${this.amount.value} sent to ${this.recipient.value}` })
                .then(() => {
                  this.reset();
                });
            },
            (res) => {
              this.error.dialog({ text: res && res.message ? res.message : 'An error occurred while sending the transaction.' });
            },
          )
          .finally(() => {
            this.loading = false;
          });
        }, () => {
          this.loading = false;
        });
    }

    setMaxAmount() {
      this.amount.value = Math.max(0, this.amount.max);
    }
  },
});

app.directive('ignoreMouseWheel', () => ({
  restrict: 'A',
  link: (scope, element) => {
    element.bind('mousewheel', () => element.blur());
  },
}));
