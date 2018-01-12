const pki = require('node-forge/lib/pki');

export function generateCA(attrs) {
  console.log('Generating 1024-bit key-pair...');
  const keys = pki.rsa.generateKeyPair(1024);
  console.log('Creating self-signed certificate...');
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '10000';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{
    name: 'basicConstraints',
    cA: true
  }, {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true
  }, {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true
  }, {
    name: 'nsCertType',
    client: true,
    server: true,
    email: true,
    objsign: true,
    sslCA: true,
    emailCA: true,
    objCA: true
  }, {
    name: 'subjectKeyIdentifier'
  }]);
  // FIXME: add authorityKeyIdentifier extension

  // self-sign certificate
  cert.sign(keys.privateKey/*, forge.md.sha256.create()*/);
  console.log('Certificate created.');

  // PEM-format keys and cert
  return {
    privateKey: pki.privateKeyToPem(keys.privateKey),
    publicKey: pki.publicKeyToPem(keys.publicKey),
    certificate: pki.certificateToPem(cert)
  };
}

// // verify certificate
// const caStore = forge.pki.createCaStore();
// caStore.addCertificate(cert);
// try {
//   forge.pki.verifyCertificateChain(caStore, [cert],
//     function(vfd, depth, chain) {
//       if(vfd === true) {
//         console.log('SubjectKeyIdentifier verified: ' +
//         cert.verifySubjectKeyIdentifier());
//         console.log('Certificate verified.');
//       }
//       return true;
//   });
// } catch(ex) {
//   console.log('Certificate verification failure: ' +
//   JSON.stringify(ex, null, 2));
// }