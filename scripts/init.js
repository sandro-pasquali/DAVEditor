(function(){
  
/**
 * Simply setting up some namespaces for the Editor.
 */
AXIS.createNamespace(
  'Editor',
  'Editor.FileTree', 
  'Editor.TrashTree'
);

var AE = $AXIS.Editor;

/**
 * Content types handled by the editor.  The purpose of this information is assignment
 * of style brushes, mainly.  Note that if isn't necessary to add all the possible
 * `text` types: only those with specialized brushes; others get default `text` brush.
 *
 * @see   $AXIS#Editor#isEditableFile
 */
var contentTypes = 
  {
    'text/html':                'html',
    'text/css':                 'css',
    'text/x-java-source':       'java',
    'application/javascript':   'js',
    'application/xml':          'xml',
    'application/json':         'js',
    'application/x-php':        'php',
    
    'application/x-empty':      'html',
    'application/x-empty; charset=binary': 'html'
  };
  
/**
 * A collection of open folders. Used primarily to maintain state when
 * changes to the tree occur.
 */
AE.openFolders = [];

/**
 * Generally we want tree nodes to expand asynchronously.  In very 
 * specialized cases (particularly where a specific deep node has
 * been requested, prob. via bookbark) we want to turn on synchronous 
 * behaviour in order to ensure in-order folder expansion.
 *
 * @see #openFile
 * @see TreeControl.js#load
 */
AE.FileTree.isAsynch = true;

/**
 * Set up subscribable events for file tree and trash tree. See initialization 
 * UI panels for treeFilesPanel and trashFilesPanel below. NOTE that the trash
 * panel is only created for logged-in users (event will never fire if not logged in).
 */
AE.fileTreeReady  = AXIS.CustomEvent.create();
AE.trashTreeReady = AXIS.CustomEvent.create();

/**
 * Track when folders are loaded
 */


/**
 * Set up a subscribable event, to fire when the editor is fully initialized.
 *
 * @href plugins/editor/editor.html
 */
AE.editorReady = AXIS.CustomEvent.create({
  name: 'editorReady'
});

AE.editorReady.subscribe({
  callback: function(r) {
    //alert(AE.editorReady.hasFired());
  }
});

/**
 * Might do something here with unload
 */
AXIS.onBeforeUnload.subscribe({
  callback: function(w) {
  }
});

/**
 * Set up general file open/close/loading tracking.  As an open file is always 
 * loaded in a tab, the states of tabs are the flags to check.
 */
AE.tabOpened        = AXIS.CustomEvent.create();
AE.tabClosed        = AXIS.CustomEvent.create();
AE.tabSelected      = AXIS.CustomEvent.create();
AE.tabLoadStarted   = AXIS.CustomEvent.create();


AE.tabOpened.subscribe({
  callback: function(inf) {
    //console.log(AE.editorRef.getCurrentFile('editor_target'));
  }
});

/*
AE.tabClosed.subscribe({
  callback: function(inf) {
    console.log('closed');
    console.log(inf);
  }
});

AE.tabSelected.subscribe({
  callback: function(inf) {
    console.log('selected');
    console.log(inf);
  }
});


AE.tabLoadStarted.subscribe({
  callback: function(inf) {
    console.log('load started');
    console.log(inf);
  }
});
*/

/**
 * As files are opened in the editor, the fragment changes to make bookmarking
 * possible. When that file is closed, we need to either switch to another tab
 * (which will then change the fragment itself, as described above), or if there
 * are no open files, set the fragment to its original value.  Store it.
 *
 * @href plugins/editor/editor.html#tabClose
 * @href plugins/editor/editor.html#tabSelect
 */
AE.originalFragment = AXIS.parseUrl().fragment;

/**
 * This will be set to a bit name, assuming the path sent matches on
 * /\/home\/[^\/]*\/bits\/([^\/]*)/ (being set to captured group).
 *
 * @see History.onChange subscriber, below.
 */
AE.requestedBitName = '';

/**
 * Set to the current fragment, updated as fragment changes.
 *
 * @see History.onChange subscriber, below.
 */
AE.requestUrl = '';


/**
 * Reference to the editor object.  Set by #editAreaLoaded in:
 *
 * @url plugins/editor/editor.html
 */
AE.editorRef = {};

/**
 * Whether user is logged in.  This matters should a bar action change their
 * status.
 */
AE.isLoggedIn = AXIS.User.isLoggedIn();

/**
 * Stores resource data. 
 *
 * @see #setResourceInfo
 * @href TreeControl.js
 */
AE.resourceInfo = {};

/**
 * Listen for changes in auth status.  Mainly we're watching for situations 
 * where the user was logged in, then while in a logged in state (with all the
 * power that entails) the user logs out.  Need to refresh in that case.
 */
AXIS.Login.onAuthUpdate.subscribe({
  callback: function(f) { 
    var user = f.data;
    if(user === false && AE.isLoggedIn)
      {
        AE.isLoggedIn = false;
        top.location.reload(true); 
      }
  }
});

/**
 * Indicates whether there is something available in the clipboard.  As there is no
 * mechanism by which the user can clear the clipboard, once this value is `true`,
 * it will be true for the entire session.  So we need to simply check the
 * clipboard once.  Mainly, the affects the availability of the `paste` option
 * for the context menu.  Its initial value is set in the initialization routine, below.
 * If the clipboard is clipped to (via `cut` or `copy`), this will be set to `false`.
 *
 * @see $AXIS#Editor#TreeController#cut
 * @see $AXIS#Editor#TreeController#paste
 */
AE.clipboardEmpty = true;

/**
 * The user's home path.
 */
AE.userHomeUrl =  AE.isLoggedIn 
                  ? '/home/' + AXIS.User.username() 
                  : '';

/**
 * The /trash and /clipboard folders are DAV folders(collections) like any other,
 * and the user can always delete them.  However, whenever we're in file editing mode, 
 * the trash and clipboard must exist, so if they are not there, we need to create them.
 *
 * @see TreeController.js#trash
 * @see TreeController.js#cut
 * @see TreeController.js#copy
 * @see TreeController.js#paste
 */
if(AE.isLoggedIn)
  {
    AXIS.WebDAV.MKCOL({
      url: AE.userHomeUrl + '/trash',
      headers: {
        'If-None-Match': '*'
      }
    });
    
    AXIS.WebDAV.MKCOL({
      url: AE.userHomeUrl + '/clipboard',
      headers: {
        'If-None-Match': '*'
      }
    });
  }

/**
 * Creates an id usable as #id attribute of a dom element.
 *
 * @param   {String}    txt     The text to SHA1.
 * @param   {String}    [pre]   A prefix. Default to '_'.
 */
AE.getId = function(txt, pre)
  {
    return (pre || '_') + AXIS.SHA1.hex_sha1(txt);
  }

/**
 * Resizes the header. Intended for use by Bar, when it switches modes, which
 * sometimes alters its height.
 */
AE.setHeaderHeight = function(h) 
  {
    if(AXIS.isNumber(h))
      {
        $('desktopHeader').setStyle('height',h);
        if(MochaUI.Desktop.setDesktopSize)
          {
            MochaUI.Desktop.setDesktopSize();
          }
      }
  };

AE.openFile = function(url) 
  {
    var resInf, rfid, pComp, tmpP, tmpR, tmpN;
    var rbUrl = AE.resourceByUrl(url);
    
    /**
     * The url is not a registered resource. This means that the collection which
     * contains this resource has not been opened -- as the tree loads its resources
     * only when requested, and not the entire tree up front, 
     */
    if(!!rbUrl === false)
      {
        /**
         * No filetree model; wait for it.
         */
        if(AE.fileTreeReady.hasFired() === false)
          {
            AE.fileTreeReady.subscribe({
              callback: function() {
                /**
                 * Now make sure the editor is ready
                 */
                AE.editorReady.subscribe({
                  callback: function() {
                    /**
                     * Everything ready... try again.
                     */
                    AE.openFile(url);
                  }
                });
              }
            });  
          }
        else
          {
            /**
             * Unregisterd Url. Subpath of current Bit?
             */
            subP = url.replace(AE.requestedBitPath + '/','');
            if(subP !== url)
              {
                /**
                 * Ok, subpath of current bit. Get the path components,
                 * open all folders that need to be opened in order to
                 * satisfy all path components, and if a file terminates
                 * the path, load it.
                 */
                pComp = subP.split('/');
                tmpP  = AE.requestedBitPath;
                
                /**
                 * Don't let anything else execute until the
                 * tree model has been properly updated to reflect
                 * the requested hash path.
                 */
                AE.FileTree.isAsynch = false;
                
                do
                  {
                    tmpP += '/' + pComp.shift();
                    tmpR = AE.resourceByUrl(tmpP);
                    
                    if(!!tmpR)
                      {
                        /**
                         * This fetches the Node object, which has the info &
                         * methods we need to perform operations on nodes, 
                         * such as #toggle.
                         */
                        tmpN = AE.FileTree.get(tmpR.id);
                        
                        /**
                         * Open folders.
                         */
                        if(tmpN.data.type === 'collection')
                          {
                            if(tmpN.open === false)
                              {
                                tmpN.toggle();
                              }
                          }
                        else
                          {
                            /**
                             * Or load a file (we must have loaded the full path and 
                             * relevant data, so try the url again).
                             */
                            AE.openFile(url);
                          }
                        
                        /**
                         * Select this latest node.
                         */
                        AE.FileTree.select(tmpN);  
                      }
                    else
                      {
                        /**
                         * Hmm.  So the requested path fragment is not valid.
                         * Update the hash to what we have now -tail, and break.
                         */
                        AE.updateFileHash(tmpP.substring(0,tmpP.lastIndexOf('/')));
                        break;
                      }
                  } 
                while(pComp.length);

                AE.FileTree.isAsynch = true;
              }
            /**
             * The url is not part of this Bit. Usually this means the user
             * has manually typed in some random path that has nothing to
             * do with the original, or a path created via the tree control.
             * In this case we simply reload.
             */
            else
              {
                top.window.location.reload();
              }
          }
          
        return;
      }

    /**
     * Get resource info.  Two key uses: to determine if the file
     * exists, and to get the file's content-type.
     */
    resInf =  AXIS.WebDAV.fileInfo({
      url:      url,
      asynch:   false
    });

    if(resInf.success)
      {
        /**
         * Select the node we are going to be loading.
         */
        rfid = AE.FileTree.get(rbUrl.id);   
        AE.FileTree.select(rfid);

        /**
         * At this point we know that we have a reference to the resource url. As
         * the user can always just type in a folder path, we check if that is what
         * has happened (check if a collection).  If it is, then we make sure the
         * requested folder is open.  We then exit, as only files can be loaded. Note
         * that this only handles folders visible in the current fileTree state.  For
         * handling of the user typing in /some/long/path/below/tree (which we would
         * not have a reference to in #resourceInfo), see above.
         */
        if(resInf.resourcetype === 'collection')
          {           
            if(rfid)
              {
                rfid.load(url);
              }
            return; 
          }
        
        AE.tabLoadStarted.fire(url);
          
        AXIS.Loader.load({
          method:       'GET',
          headers:      {
            'X-No-Rewrite': '1'
          },
    		  url:          url,
    		  breakCache:   true,
    		  callId:       url,
    		  loadingMsg:   'Loading :: ' + url,
    		  onSuccess:     function(r)
    		    {
    		      /**
    		       * Opera is having problems here.  For some reason, the XMLHTTP
    		       * call (ie. the Queue instance) continues to run.  So we manually
    		       * kill it.  TODO: investigate.  Think the object is simply in an error state.
    		       */
    		      if(AXIS.isOpera)
    		        {
    		          AXIS.Queue.killByPropertyValue('callId',r.callId);  
    		        }
    
              /**
               * Can only edit 'text' types
               */
              var iE = AE.isEditableFile(resInf);
              if(iE)
                {
                  /**
                   * NOTE that #openFile here is a method of the editor object
                   * (AE.editorRef).
                   *
                   * @href plugins/editor/editor.html
                   */
                  AE.editorRef.openFile('editor_target',{
                    id:       r.origRequestUrl,
                    text:     $AXIS.Modules.local.JSBeautify.beautify(r.responseText)
                  });

                  AE.updateFileHash(r.origRequestUrl);
                  AE.editorRef.execCommand('editor_target', 'change_syntax', iE); 
                }
              else
                {
                  /**
                   * Not editable. Handle.
                   */
                  AE.handleNonEditableFile(resInf);
                }
    		    }
    		});
      }
    else
      {
        MochaUI.notification('That file has been deleted');  
      }
  };


    
/**
 * Determine whether anything is in clipboard.
 *
 * @see TreeController.js#cut
 * @see TreeController.js#copy
 * @see TreeController.js#paste
 */
AXIS.WebDAV.readFolder({
  url:        AE.userHomeUrl + '/clipboard',
  asynch:     true,
  onSuccess:  function(r) {
    if(r.folder.children.length > 0)
      {
        AE.clipboardEmpty = false;
      }
  }
});

/**
 * Changes the current file path displayed in the editor panel.
 */
AE.setEditorTitlebar = function(t)
  {
    var tx = t ? t + ' source' : '';
    $('mainPanel_title').set('text', decodeURIComponent(tx));
  };


/**
 * Sets the #resourceInfo objects.  NOTE: no checking is done
 * for proper arguments: this is internal, and should be correctly
 * implemented.
 *
 * @param   {String}    ed    A resource object id.
 * @param   {Object}    inf   The information to attach to resource object.
 */
AE.setResourceInfo = function(id, inf)
  {
    var i = this.resourceInfo[id] = {};

    i.url           = inf.url;
    i.Cups          = inf.ob.Cups || {};
    i.resourcetype  = inf.ob.properties.resourcetype ? 'collection' : 'file';
    i.isOpen        = !!inf.isOpen;
    i.openInEditor  = !!inf.openInEditor;
    i.id            = id;
    i.props         = inf.ob.properties;
  }
  
/**
 * Removes a resource.  Note that all children will also be removed.
 *
 * @param   {String}    res   A resource object.
 */
AE.deleteResourceInfo = function(res)
  {
    var ri    = this.resourceInfo;

    for(var p in ri)
      {
        /**
         * If the resource url begins with exactly the sent url, delete.  This
         * takes care of all child resources as well.
         */
        if(ri[p].url.indexOf(res.url) === 0)
          {
            /**
             * Close if open in editor.
             */
            if(ri[p].openInEditor)
              {
                AE.editorRef.closeFile('editor_target', ri[p].url);
              }
              
            delete ri[p];  
          }
      }
  }
   
/**
 * Each node of the browser tree is identified via an id, which is a 
 * SHA1 of the resource path node is bound to.  Find url based on id.
 *
 * @href TreeControl.js
 */
AE.resourceById = function(id)
  {
    return this.resourceInfo[id];
  };

/**
 * Each node of the browser tree is identified via an id, which is a 
 * SHA1 of the resource path node is bound to.  Find id based on url.
 *
 * @href TreeControl.js
 */
AE.resourceByUrl = function(url)
  {
    for(var z in this.resourceInfo)
      {
        if(this.resourceInfo[z].url === url)
          {
            return this.resourceInfo[z];
          }
      }
  };
  
/**
 * Set the location fragment command to file. By doing this, you will be causing
 * a fire() of the History.onChange event, and is the method you should use if
 * you want to change a file. Send nothing to clear the hash.
 * 
 * @param   {String}    url     The url you want to load. Send nothing to clear.
 * @see #openFile
 * @see #switchTab
 * @href plugins/editor/editor.html#tabSelect
 */
AE.updateFileHash = function(url)
  {
    if(AXIS.isUndefined(url))
      {
        AXIS.History.clear();
        return;  
      }
      
    AXIS.History.set({
      command: url
    });
  };

/**
 * Switches to a currently displayed tab.  Mainly this is fired by the tree control,
 * handling re-selections of files in the tree which are already open in the editor,
 * avoiding the need to recheck the file, get info, etc.  
 *
 * @see TreeControl.js#changeCurrentFile
 */
AE.switchTab = function(url)
  {
    AE.editorRef.execCommand('editor_target', 'switch_to_file', url, false); 
    AE.updateFileHash(url);
  };
  
    /**
     * Called when a file that is not editable (a non-text file) is
     * selected. Will show selected image files in a popup, for example.
     *
     * @see   #changeCurrentFile
     */
AE.handleNonEditableFile = function(inf)
  {
    var url = inf.Caller.url;

    /**
     * Image files are shown in a popup. Mainly this involves preloading the
     * image, getting its w/height, and creating a properly sized window.
     */
    if(inf.contenttype.indexOf('image/') !== -1)
      {
        /**
         * Get the image name
         */
        var iName = url.substring(url.lastIndexOf('/')+1,url.length);
        
        /**
         * Preload image, when loaded fetch h/w values
         * and open window containing image, relatively sized.
         */
        var imWin = new Image;
        imWin.onload = function()
          {
            var pos   = parseInt(Math.random() * 100);
            var w     = Math.min(this.width + 20, document.body.getSize().x -pos -60);
            var h     = Math.min(this.height + 40, document.body.getSize().y -pos -60);
            
            new MochaUI.Window({
        		  id:           $AXIS.Editor.getId(url, 'winid_'),
        			title:        iName,
          		loadMethod:   'iframe',
          		contentURL:   url,
          		x:            pos,
          		y:            pos,
        			width:        w,
        			height:       h
        	  });
          }
        imWin.src = url + AXIS.getUniqueId('?');
      }
    else
      {
        MochaUI.notification('Not editable.');
      }
  };
  
/**
 * Determine if the resource is editable.  Anything with
 * text/* is editable. Other cases are application/javascript.
 */
AE.isEditableFile = function(inf)
  {
    var ct = inf.contenttype;
    
    /**
     * An expected content type.
     */
    if(contentTypes[ct])
      {
        return contentTypes[ct];
      }
      
    /**
     * Ok, not in the main list.  However, any text/ type can be
     * assumed to be something editable.  Give it an 'generaltext' syntax.
     */
    if(ct.match(/^text\/.*$/))
      {
        return 'generaltext';  
      }
      
    return false;
  };
  
  
  
  
/*********************************
 * 
 * Request listener.
 *
 *********************************/
  
/**
 * Listens for url fragment changes. Note: The expectation is that this page
 * will have a fragment set on initial load.
 */
AXIS.onHashChange.subscribe({
  callback: function(a){
    var hS, rbUrl;
    
    /**
     * There is an edge case where a non-bit file is requested.  Since we need a 
     * collection for FileTree, a hash argument is sent indicating that we need
     * to load the containing collection for this file.  
     */
    if(a.data.params.loadColl)
      {
        $AXIS.Editor.FileTree.root.load(a.data.params.loadColl);
        AXIS.History.unset([ 
          'loadColl'
        ]);
        
        return;  
      }
    
    /**
     * The folder the editor was pointed to, sent via hash.  It is expected
     * that this is a bit folder, but can be anything.
     */
    var url = AE.requestUrl = a.data.command;
    
    /**
     * Ensure that the final character of the hash is not a slash
     */
    hS = AE.requestUrl.match(/^(.*)\/$/);

    if(hS)
      {
        window.location.replace(window.location.href.replace('#' + hS[0], '#' + hS[1]));
        url = hS[1];  
      }
    
    /**
     * The user can always change the hash.  We have to stay with a bit-centric
     * focus.  So the file tree is *always* loading a bit, even if the request
     * is for a file in a folder several levels down.  So here we parse out the
     * bit name and the bit path.
     */
    AE.requestedBitName = url.match(/\/home\/[^\/]*\/bits\/([^\/]*)/);
    AE.requestedBitPath = url.match(/(\/home\/[^\/]*\/bits\/[^\/]*)/);

    AE.requestedBitName = !!AE.requestedBitName 
                          ? AE.requestedBitName[1] 
                          : url;
                          
    AE.requestedBitPath = !!AE.requestedBitPath 
                          ? AE.requestedBitPath[1] 
                          : false;
                     
    rbUrl = AE.resourceByUrl(url);  
    
    /**
     * If the url is already open, simply switch to its tab.  This behaviour 
     * usually results from the use of browser back/forward buttons.
     */
    if(rbUrl && rbUrl.openInEditor)
      {
        AE.switchTab(rbUrl.url);
        return;
      }

    /**
     * Try to open the url...
     */
    AE.openFile(url);
  }
});




/*********************************
 * 
 * SET UP UI
 *
 *********************************/
        
// Initialize MochaUI when the DOM is ready
window.addEvent('domready', function(){

	MochaUI.Desktop = new MochaUI.Desktop();

	/* Create Columns
	 
	If you are not using panels then these columns are not required.
	If you do use panels, the main column is required. The side columns are optional.
	Create your columns from left to right. Then create your panels from top to bottom,
	left to right. New Panels are inserted at the bottom of their column.

	*/	 
	new MochaUI.Column({
		id: 'treeControlsColumn',
		placement: 'left',
		width: 300,
		resizeLimit: [100, 500]
	});

	new MochaUI.Column({
		id: 'mainColumn',
		placement: 'main',	
		width: null,
		resizeLimit: [100, 300]
	});


	/**
	 * Add panels to relevant columns.  Mainly, this involves
	 * adding the editor panel to the right column (which it dominates),
	 * and adding the FileTree and TrashTree Tree controls to the
	 * left column.
	 */
	 
	/**
	 * #mainPanel
	 *
	 * Loads the editor source viewer.
	 */
	new MochaUI.Panel({
		id: 'mainPanel',
		loadMethod: 'iframe',
		contentURL:       'plugins/editor/editor.html',
		title: 'Editor',
		column: 'mainColumn',
		minimizable: false
	});
	
	/**
	 * #treeFilesPanel
	 *
	 * Loads the requested folder files.
	 */
	new MochaUI.Panel({
		id:               'treeFilesPanel',
		title:            AE.requestedBitName,
		loadMethod:       'xhr',
		contentURL:       'pages/treeFilesPanel.html',
		column:           'treeControlsColumn',
		onContentLoaded:  function(){
      
      var htmlUrl, htmUrl;
      var url         = false;
      var rp          = AE.requestedBitPath || AE.requestUrl;

      htmlUrl     = rp + '/index.html';
      htmUrl      = rp + '/index.htm';
           
      /**
       * Create a tree control for the root filesystem node passed
       * to this Bit.
       */
      AE.FileTree = new TreeControl({
        //fileTips: true,
        containerId:  'container_treeFilesPanel',
        contextMenu:  true,
        controller:   new TreeController,
        treeUrl:      rp,
        rootLabel:    ''
      });
      
      AE.FileTree.load(function() {
        /**
         * This runs on every file tree load.  We want to check for default
         * index file only once.  Check editor subscription; do not run if
         * it has already fired.  TODO: improve this... ugly.
         */
        if(AE.fileTreeReady.hasFired() === true)
          {
            return;  
          }
          
        /**
         * Need to wait for the editor to be ready before loading any 
         * default index files.  Note that we don't do this if we are not
         * at the bit root -- only when loading a bit proper do we load
         * any default index files.  
         */
        if(AE.requestedBitPath && AE.requestUrl === AE.requestedBitPath)
          {
            AE.editorReady.subscribe({
              callback: function() {
                /**
                 * Look for index.html / index.htm files in the requested folder,
                 * and send load command if any.  The priority is .html > .htm
                 */
                if(AE.resourceByUrl(htmlUrl))
                  {
                    AE.updateFileHash(htmlUrl);
                  }
                else if(AE.resourceByUrl(htmUrl))
                  {
                    AE.updateFileHash(htmUrl);
                  }
              }
            });
          }
          
        AE.fileTreeReady.fire();
      });   
		}
	});

  /**
   * If the user is logged in, provide trash panel
   */
  if(AE.isLoggedIn)
    {
    	new MochaUI.Panel({
    		id:               'trashFilesPanel',
    		title:            'Trash',
    		loadMethod:       'xhr',
    		contentURL:       'pages/trashFilesPanel.html',
    		column:           'treeControlsColumn',
    		onContentLoaded:  function() {
          
          /**
           * Set initial state of trash panel to collapsed.
           */
          $('trashFilesPanel_minmize').fireEvent('click');
          
          /**
           * Create a tree control for the root filesystem node passed
           * to this Bit.
           */
          AE.TrashTree = new TreeControl({
            //fileTips: true,
            containerId:  'container_trashFilesPanel',
            contextMenu:  true,
            controller:   new TreeController,
            treeUrl:      AE.userHomeUrl + '/trash',
            rootLabel:    ''
          });
          
          AE.TrashTree.load(function() {
            if(AE.trashTreeReady.hasFired() === false)
              {
                AE.trashTreeReady.fire();  
              }
          });   
    		}
    	});       
    }
    
	MochaUI.Modal = new MochaUI.Modal();
	
	/**
	 * Allow the setting of confirmation dialogs
	 */
	MochaUI.confirm = function(b)
	  {
	    b = b || {};
	    var msg = b.msg || false;
	    
	    if(msg === false)
	      {
	        return;  
	      }
	      
	    /**
	     * Set callback
	     */
	    AE.modalCB = b.callback || AXIS.F;
	    
	    var confirmLabel  = b.confirmLabel  || "Confirm";
	    var cancelLabel   = b.cancelLabel   || "Cancel";
	    
	    var html = '<br /><br /><input type="button" class="modal_confirm_true" onclick="$AXIS.Editor.modalCB(true);MochaUI.closeWindow(MochaUI.currentModal);" value="' + confirmLabel + '" /><input type="button" class="modal_confirm_false" onclick="$AXIS.Editor.modalCB(false); MochaUI.closeWindow(MochaUI.currentModal);" value="' + cancelLabel + '" />';
	      
      new MochaUI.Window({ 
        id:         '__confirm__', 
        title:      b.title || 'Confirm', 
        type:       'modal', 
        closable:   false,
        loadMethod: 'html', 
        content:    msg.toString() + html, 
        width:      340, 
        height:     150 
      }); 
    }
    
	/**
	 * Prompt user for input
	 */
	MochaUI.prompt = function(ob)
	  {
	    var msg = ob.message || 'Prompt';
	    var cb  = ob.callback || AXIS.F;
	    var sb  = ob.submitLabel || 'Send';
	    
	    if(typeof msg == 'undefined')
	      {
	        return;  
	      }
	      
	    /**
	     * Set callback
	     */
	    AE.modalCB = cb || AXIS.F;
	    
	    var html = '<br /><br /><input type="text" id="modal_prompt" /><br /><input type="button" value="' + sb + '" onclick="$AXIS.Editor.modalCB($(\'modal_prompt\').value);MochaUI.closeWindow(MochaUI.currentModal);" />';
	      
      new MochaUI.Window({ 
        id:         '__prompt__', 
        title:      ob.title || '', 
        type:       'modal', 
        closable:   false,
        loadMethod: 'html', 
        content:    msg.toString() + html, 
        width:      ob.width || 420, 
        height:     ob.height || 260 
      }); 
      
      //$('modal_prompt').focus();
    }

	MochaUI.Desktop.desktop.setStyles({
		'background': '#fff',
		'visibility': 'visible'
	});
});

/**
 * Clean up when user leaves.
 */
window.addEvent('unload', function(){
	if (MochaUI) MochaUI.garbageCleanUp();
});


})();


















