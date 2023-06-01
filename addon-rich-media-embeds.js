const genHash = (len) => {
  const s = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array(len).join().split(',').map(function() { 
    return s.charAt(Math.floor(Math.random() * s.length)); 
  }).join('')
}

const getBase64StringFromImg = (image) => {
  return new Promise((resolve) => {
    fetch(image).then((res) => res.blob()).then((blob) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });
  });
}

const genErrorCard = async (error, hash, doc) => {
  let desc = '';
  if (error instanceof TypeError) desc = 'Unknown URL provided';
  doc.getElementById(hash).innerHTML = `<span>${desc}; ${error}<span/>`;
}

const genGitHubCard = async (gh, hash, doc) => {
  const og_url = `https://opengraph.githubassets.com/${hash}/${gh.groups.owner}/${gh.groups.repo}`;
  const img64 = await getBase64StringFromImg(og_url);
  doc.getElementById(hash).innerHTML = `<img class="rich-embed-gh" alt="${gh.groups.owner}/${gh.groups.repo}" src="${img64}"/>`;
}

const genOpenGraphCard = async (url, hash, doc) => {
  fetch((proxy_server + url))
  .then(response => response.text())
  .then(async (html) => {
    const docc = new DOMParser().parseFromString(html, 'text/html');

    let ogTitle, ogDescription, ogImage;
    
    if (docc.querySelector('meta[property="og:title"]')) {
      ogTitle = docc.querySelector('meta[property="og:title"]').getAttribute('content'); 
      console.log('Title: OG', ogTitle);
    } else if (docc.querySelector('title')) {
      ogTitle = docc.querySelector('title').innerText;
      console.log('Title: Vanilla', ogTitle);
    } else {
      ogTitle = url;
      console.log('Title: Missing', ogTitle);
    }

    if (docc.querySelector('meta[property="og:description"]')) {
      ogDescription = docc.querySelector('meta[property="og:description"]').getAttribute('content');
      console.log('Description OG', ogDescription);
    } else if (docc.querySelector('title')) {
      ogDescription = docc.querySelector('title').innerText;
      console.log('Description Vanilla', ogDescription);
    } else {
      ogDescription = '';
      console.log('Description Missing', ogDescription);
    }

    if (docc.querySelector('meta[property="og:image"]')) {
      ogImage = docc.querySelector('meta[property="og:image"]').getAttribute('content');
      console.log('Image OG', ogImage);
    } else if (docc.querySelectorAll('img').length > 0) {
      let biggestImage = null;
      let maxArea = 0;
      for (let img of docc.querySelectorAll('img')) {
        const area = img.width * img.height;
        if (area > maxArea) {
          biggestImage = img;
          maxArea = area;
        }
      }
      if (biggestImage) {
        ogImage = (new URL(url)).origin + biggestImage.attributes.src.nodeValue;
        console.log('Image Biggest', ogImage);
      } else {
        ogImage = (new URL(url)).origin + docc.querySelectorAll('img')[0].attributes.src.nodeValue;
        console.log('Image First', ogImage);
      }
    } else {
      ogImage = './icon-180.png';
      console.log('Image Missing', ogImage);
    }

    const container = document.createElement('div');
          container.id = (`temp-card-container-${hash}`);
          container.className = "temp-card-container";
    const subcontainer = document.createElement('div');
    
    const thumbnail = document.createElement('img');
          thumbnail.src = await getBase64StringFromImg((proxy_server + ogImage));
    const title = document.createElement('h1');
          title.textContent = ogTitle;
    const description = document.createElement('p');
          description.textContent = ogDescription;
    const source = document.createElement('span');
          source.textContent = (new URL(url)).hostname;

    subcontainer.appendChild(title);
    subcontainer.appendChild(description);
    subcontainer.appendChild(source);
    container.appendChild(thumbnail);
    container.appendChild(subcontainer);

    document.body.appendChild(container)
    
    const tempCard = document.getElementById(`temp-card-container-${hash}`);
    html2canvas(tempCard).then((canvas) => {
      doc.getElementById(hash).innerHTML = `<img class="rich-embed-og" alt="${url}" src="${canvas.toDataURL("image/jpeg")}"/>`;
    });
    if (remove_tempCard) {
      tempCard.remove()
    }

  })
  .catch(error => console.error(error));
}
 
const populate_rich_embed = async (url, hash, doc) => {
  
  const github = url.match(/(?:git@|https:\/\/)github.com[:/](?<owner>.+)\/(?<repo>.+)(?:\.git)?/i);
  const new_redit = /www\.reddit\.com/.test(url)
  try {
    if (github) {
      genGitHubCard(github, hash, doc);
    } else if (new_redit) {
      url = url.replace('www.reddit.com', 'old.reddit.com');
      genOpenGraphCard(url, hash, doc);
    } else {
      genOpenGraphCard(url, hash, doc);
    }  
  } catch (error) {
     genErrorCard(error, hash, doc);
  }
}

// Use BookStack editor event to add custom "Insert Rich Media Embed" button into main toolbar
window.addEventListener('editor-tinymce::pre-init', event => {
  const mceConfig = event.detail.config;
  mceConfig.toolbar = mceConfig.toolbar.replace('link', 'link richembed')
});

// Use BookStack editor event to define the custom "Insert Rich Media Embed" button.
window.addEventListener('editor-tinymce::setup', event => {
  const editor = event.detail.editor;

  editor.ui.registry.addButton('richembed', {
    tooltip: 'Insert Rich Embed',
    icon: 'code-sample',
    onAction() {
      editor.windowManager.open({
        title: 'Insert Rich Embed',
        body: {
          type: 'panel',
          items: [{type: 'textarea', name: 'embedurl', label: 'EMBED URL'}]
        },
        onSubmit: function(e) {
          const hash = genHash(100);
          editor.insertContent(`
            <a class="rich-embed" href="${e.getData().embedurl}" id="${hash}">
              <img src="/loading.gif" id="rich-embed-loading"/>
            </a>
          `);
          populate_rich_embed(e.getData().embedurl, hash, editor.getDoc())
          e.close();
        },
        buttons: [ { type: 'submit', text: 'Insert Rich Embed' } ]
      });
    }
  });

});