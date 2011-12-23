/**
 * This is the constructor for the tree controller to be passed to new 
 * instances of #TreeControl.
 * @author Sandro Pasquali (spasquali@gmail.com)
 *
 * @see #TreeControl
 */
var TreeController = function()
  {
    var AE = $AXIS.Editor;
    
    /**
     * Handles cases where there is an operation changing the name of a resource and
     * the target folder contains another resource with the same name.  The idea is to
     * maintain the operation by alerting the user to the conflict and offering 
     * solutions.  For this reason the method receives an active XHR call object.
     *
     * @param     {Object}      r     An XHR call object.
     * @see       #setFailureHandler
     */
    this.handleNameConflict = function(r)
      {
        /**
         * Find an aleternate name and try again.  To do this we need to
         * fetch taken names in the destination folder. Assume the destination
         * folder is whatever terminates with last `/`.
         */
        var dest      = r.destination;
        var destFold  = dest.substring(0,dest.lastIndexOf('/'));
        var n         = r.destination.replace(destFold,'');
        
        MochaUI.confirm({
          title:        "Rename conflict",
          msg:          "There is a naming conflict. The name that you requested (<b>" + n + "</b>) is taken.  What would you like to do?",
          cancelLabel:  "I'll rename it myself",
          confirmLabel: "Rename it for me",
          callback: function(v) {
            if(v === false)
              {
                /**
                 * Check if there was an rename session open, and if so, refocus.
                 */
                var rnI = $("renameInput");
                if(rnI)
                  {
                    rnI.focus();  
                    rnI.select();
                  }
                else
                  {
                    MochaUI.notification("Rename cancelled.");
                  }
              }
            else
              {
                /**
                 * Get folder info for folder. Fetch the names.
                 */
                var flds      = AXIS.WebDAV.readFolder({
                  asynch:     false,
                  url:        destFold
                });
                
                var eN        = flds.folder.children;
                var nN        = [];
                
                /**
                 * Create an array of existing names.
                 */
                for(var w=0; w < eN.length; w++)
                  {
                    nN.push(eN[w].href)  
                  }
                          
        
                /**
                 * Now find an altername name and repeat the call, modifying destination.
                 */
                r.asynch      = false;
                r.destination = AXIS.Util.uri.findAlternateName(dest, nN);
                AXIS.WebDAV[r.method](r);
              }
          }
        });
      };
    
    /**
     * General failure handler, which failures are common across 
     * most functionality.
     *
     * @param     {String}      gFMess    The message to display for any failure status
     *                                    codes not explicitly caught.
     */
    this.setFailureHandler = function(gFMess)
      {
        var rnH = this.handleNameConflict;  
        
        return function(r) 
          {
            var st  = r.getStatus();
            
            switch(st)
              {
                case 401:   
                  MochaUI.notification("You must be logged in to do that.");
                break;
                
                case 403:
                  MochaUI.notification("You do not have permission to do that.");
                break;
                
                case 412:
                  rnH(r);
                break;
                
                default:
                  MochaUI.notification(gFMess);
                break;
              }
          }  
      };
      
    /**
     * Will take a file/folder url and parse out the relevant bits.  
     *
     * @see #trash
     * @see #duplicate
     * @see #rename
     * @see #unlink
     */
    this.parseUrl = function(url)
      {
        var ret   = {};
        var ns    = url.split('/');
        
        ret.url   = url;
        
        /**
         * This strips off the last segment of the url path, which
         * is only relevant when this represents a file.
         */
        ret.file  = ns.pop();
        
        /**
         * Length is zero(0) if only a filename is sent (`index.html`)
         */
        if(ns.length == 0)
          {
            ret.folder = '/';
          }
        else
          {
            ret.folder = ns.join('/')
          };  

        return ret;
      };
    
    this.refreshFolder = function(url)
      {
        var ownerTree, node;
        var e     = AE.resourceByUrl(url)
        var tp    = AE.userHomeUrl + '/trash'
        
    	  if(url.substring(0,tp.length) === tp)
    	    {
    	      ownerTree = AE.TrashTree;
    	    }
        else
          {
            ownerTree = AE.FileTree;
          }
          
        try
          {
            node  = ownerTree.get(e.id);

            node.load(url, function(t) {
              // Find any previously open folders under this tree.
            });  
          }
        catch(e)
          {
            ownerTree.root.load(AE.resourceById(ownerTree.root.id).url);  
          }
      };  

    this.rename = function(url, typ, e, r)
      {
        /**
         * We want to know the dimensions of the textarea which will function as the
         * rename input. Unfortunately we have some browser differences, mainly IE
         * gets the size of the node text area, while others give text node entire
         * width of panel.  
         */
        var im  = e.getPrevious().getFirst();
        var np  = AXIS.isIE ? 0 : im.getPosition().x + im.getSize().x;
        var sx  = e.getSize().x - np + (AXIS.isIE ? -1 : 7);
        var sy  = e.getSize().y - 4;
        
        var T         = this;
        var origName  = e.get('text');
        var inpt;

        /**
         * In order to accomodate the textarea, doing some adjustments to container
         * when opening and closing edit session.  See below.
         */
        var adjustNodePadding = function(orig)
          {
            e.setStyle('padding-top', orig ? '3px' : AXIS.isIE ? '0px' : '1px');
            e.setStyle('padding-bottom', orig ? '0px' : '2px');
          }
        
        /**
         * Creating the textarea within the container which originally contained text.
         */
        adjustNodePadding();
        e.set('html', '<input type="text" id="renameInput" style="width: ' + sx + 'px; height: ' + sy + 'px;" />');

        inpt        = e.getFirst();
        inpt.value  = origName;

        /**
         * Need to cancel event propogation on actions in the text area,
         * as they will bubble to the tree, which will react to click, mdown...
         */
        inpt.addEvent('click', function(ev){
          ev.stopPropagation(); 
        });

        inpt.addEvent('dblclick', function(ev){
          ev.stopPropagation(); 
        });

        inpt.addEvent('mousedown', function(ev){
          ev.stopPropagation(); 
        });
        
        /**
         * Try to execute rename if the user hits enter in the textarea.
         */
        inpt.addEvent('keydown', function(ev) {
          if(ev.key === 'enter')
            {
              $(document).fireEvent('mousedown');
            }
        });

        /**
         * If a rename is active, any click in the document will
         * attempt to commit it.  Note that the handler for the other
         * way to commit rename -- by hitting return in textbox -- will
         * also fire this event.  See above. 
         */
        document.addEvent('mousedown', function(ev) {
          AE.FileTree.renameCommit();
          document.removeEvent('mousedown',arguments.callee);
        });
        
        /**
         * Give it a cursor
         */
        inpt.focus();
        inpt.select();
        
        /**
         * What actually commits the changes. See above event handlers.
         */
        AE.FileTree.renameCommit = function()
          { 
            /**
             * Will fire if:
             * 1. There is no change in the name.
             * 2. The entered value is empty.
             * 3. If this method is called outside of this method (inpt.value will
             *    be undefined.
             */
            if(!!inpt.value === false || origName === inpt.value)
              {
                e.empty();
                e.set('text', origName);
                adjustNodePadding(1);
                return;  
              }
                
            var fold  = T.parseUrl(url).folder;
            var nN    = fold + '/' + inpt.value;
            
            AXIS.WebDAV.MOVE({
              url:          url,
              destination:  nN,
              overwrite:    false,
                     
              onFailure:    T.setFailureHandler('Rename has failed.'),
            
              onSuccess:    function(r) {
                
                /**
                 * Check if any editor tabs are open with the old name, and if
                 * so, delete, then open new file.
                 */
                AE.FileTree.isAsynch = false;
                AE.deleteResourceInfo(AE.resourceByUrl(url));                
                T.refresh(fold);
                AE.FileTree.isAsynch = true;
                AE.updateFileHash(nN);
              }
            }); 
          };
      };
    
    /**
     * Creates a duplicate of a given file or folder, placing the clone in
     * the same directory as the original.
     */
    this.duplicate = function(url, typ)
      {
        var n = this.parseUrl(url);
        var T = this;

        MochaUI.prompt({
          title:        'Duplicate',
          submitLabel:  'Duplicate',
          message:  'Enter the name for the duplicated ' + typ + ':',
          callback: function(v){
            
            if(!!v === false)
              {
                MochaUI.notification("No name given for duplicate file."); 
                return;  
              }
            
            var nN = n.folder + '/' + v;
  
            var p = AXIS.WebDAV.COPY({
              url:          url,
              destination:  nN,
              overwrite:    false,
              
              onFailure:    T.setFailureHandler('Duplication failed.'),
  
              onSuccess:    function() {
                MochaUI.notification("Duplication successful."); 
                T.refreshFolder(n.folder);
              }
            }); 
          }
        });
      };
    
    /**
     * Will only appear as an option on a Trash folder.  Will restore a resource
     * in the trash to its original location.
     *
     * @see #trash
     */
    this.restore = function(url, typ)
      {
        var T = this;
        
        AXIS.WebDAV.getProperty({
          url:          url,
          scope:        this,
          properties:   {
            name: 'Editor_restorepath'
          },
          onSuccess: function(r) {

            try
              {
                var restorePath = r.responseXMLObject().multistatus.response
                                  .propstat.prop[r.properties.name];
              }
            catch(e)
              {
                MochaUI.notification("This file has been corrupted and automatic restoration is not possible.  You will need to manually copy the file and paste it.");
                
                return; 
              }

            /**
             * Ok, we have restore path.  Move the file.
             */
            AXIS.WebDAV.MOVE({
              url:          url,
              scope:        this,
              destination:  restorePath,
              overwrite:    false,
              
              onFailure:    T.setFailureHandler('Restore failed.'),
  
              onSuccess:    function() {
                
                /**
                 * Refresh the trash folder.
                 */
                this.refreshFolder(AE.userHomeUrl + '/trash');   
                             
                /**
                 * If the restore path is currently identifiable in the
                 * tree model, refresh it. Then update hash, which, if the
                 * folder did not exist in model, will do necessary opening.
                 */
                AE.FileTree.isAsynch = false;
                this.refresh(this.parseUrl(restorePath).folder);
                AE.FileTree.isAsynch = true;
                AE.updateFileHash(restorePath);
              }
            });
          },
          onFailure: T.setFailureHandler('Restore failed.')  
        });
      };
    
    /**
     * Places selected file/folder in the users /trash folder.  
     *
     * @see #restore
     */
    this.trash = function(url, typ)
      {
        var n   = this.parseUrl(url);

        /**
         * Trash folder location + filename...
         */
        var dest = AE.userHomeUrl + '/trash/' + n.file;
        
        /**
         * Need to add a property to the resource which stores its
         * original location.
         */
        var pp = AXIS.WebDAV.setProperty({
          url: url,
          setProperties: {
            name: 'Editor_restorepath',
            value: url
          }
        });

        var p = AXIS.WebDAV.MOVE({
          url:          url,
          scope:        this,
          destination:  dest,
          overwrite:    false,
          
          onFailure:    this.setFailureHandler('Trash failed.'),
          
          onSuccess:    function(r) {
            MochaUI.notification(typ + " moved to trash."); 

            AE.deleteResourceInfo(AE.resourceByUrl(url));

            this.refreshFolder(n.folder);
            this.refreshFolder(AE.userHomeUrl + '/trash');
          }
        }); 
      };
      
    /**
     * Empties the trash folder.  
     */
    this.empty = function(url, typ)
      {
        AXIS.WebDAV.emptyFolder({
          url: AE.userHomeUrl + '/trash'
        });
        
        this.refreshFolder(AE.userHomeUrl + '/trash');
      };
      
    /**
     * Cuts to clipboard
     */
    this.cut = function(url, typ)
      {
        var n = this.parseUrl(url);
        
        /**
         * Remove what is in the clipboard.
         */
        AXIS.WebDAV.emptyFolder({
          url: AE.userHomeUrl + '/clipboard'
        });
     
        /**
         * Now move the new file to clipboard.
         */
        AXIS.WebDAV.MOVE({
          url:          url,
          scope:        this,
          destination:  AE.userHomeUrl + '/clipboard/' + n.file,
          overwrite:    false,
          
          onFailure:    this.setFailureHandler('Cut failed.'),
        
          onSuccess:    function() {
            
            AE.deleteResourceInfo(AE.resourceByUrl(url));
            
            /**
             * Indicate that we now have something to paste.
             *
             * @see ContextMenu.js
             */
            AE.clipboardEmpty = false;
            
            MochaUI.notification('Cut to clipboard');
            this.refreshFolder(n.folder);
          }
        }); 
      };
      
    /**
     * Copies to clipboard.  The current clipboard system is singular.
     * That is, there is only one resource allowed in the clipboard at
     * any one time.  Copying = removing what is there is and replacing.
     */
    this.copy = function(url, typ)
      {
        var n = this.parseUrl(url);
        
        /**
         * Remove what is in the clipboard.
         */
        AXIS.WebDAV.emptyFolder({
          url: AE.userHomeUrl + '/clipboard'
        });
     
        /**
         * Now copy the new file to clipboard.
         */
        AXIS.WebDAV.COPY({
          url:          url,
          scope:        this,
          destination:  AE.userHomeUrl + '/clipboard/' + n.file,
          overwrite:    false,
          
          onFailure:    this.setFailureHandler('Copy failed.'),
        
          onSuccess:    function() {
            
            /**
             * Indicate that we now have something to paste.
             *
             * @see ContextMenu.js
             */
            AE.clipboardEmpty = false;
            
            MochaUI.notification('Copied to clipboard');
          }
        }); 
      };
      
    /**
     * Pastes from clipboard
     */
    this.paste = function(url, typ)
      {
        /**
         * You must be pasting to a collection, not a file.
         */
        if(typ == 'file')
          {
            return;  
          }
        
        var f = AXIS.WebDAV.readFolder({
          url:      AE.userHomeUrl + '/clipboard',
          scope:    this,
          passThru: {
            origFolder: url
          },
          onSuccess: function(r) {
            var n;
            var fL = r.folder.children;
        
            /**
             * May eventually offer multiple copy/paste...
             */
            for(var x=0; x < 1; x++)
              {
                n = this.parseUrl(fL[x].href);
                
                AXIS.WebDAV.COPY({
                  url:          fL[x].href,
                  scope:        this,
                  destination:  r.passThru.origFolder + '/' + n.file,
                  overwrite:    false,
                  onFailure:    this.setFailureHandler('Paste failed.'),
                  onSuccess:    function(r) {
                    this.refreshFolder(url);  
                  }
                });
              }
          },
          onFailure: function(r) {
            MochaUI.notification('Paste failed.');  
          }
        });
      };
      
    /**
     * Permananently deletes a file.  These files do not go to the trash.
     */
    this.unlink = function(url, typ)
      {
        var n = this.parseUrl(url);

        var ob = {
          url: url  
        };
        
        if(typ == 'collection')
          {
            ob.headers = {
              Depth: 'infinity'
            };
          }
          
        var d = AXIS.WebDAV.DELETE(ob);

        switch(d.getStatus())
          {
            case 204:
            
              AE.deleteResourceInfo(AE.resourceByUrl(url));
            
              MochaUI.notification('<b>' + n.file + '</b> deleted.');
            break;
            
            case 404:
              MochaUI.notification('<b>' + n.file + '</b> does not exist.');
            break;
            
            default:
              MochaUI.notification('An system error has occurred.');
            break;
          }
        
        this.refreshFolder(n.folder);
      };
    
    /**
     * Reloads a folder.
     */
    this.refresh = function(url, typ)
      {
        /**
         * You must be refreshing a collection, not a file.
         */
        if(typ == 'file')
          {
            return;  
          }

        this.refreshFolder(url);
      };
      
    /**
     * Opens file upload window.
     */
    this.upload = function(url, typ)
      {
        /**
         * This is the icon for upload
         */
        var ic = '<img src="images/icons/context_menu/upload.png" />';
        new MochaUI.Window({ 
          id:         'upload__' + url, 
          title:      ic + url, 
          closable:   true,
          loadMethod: 'iframe', 
          contentURL: 'plugins/uploadbit/index.html?' + url, 
          width:      500, 
          height:     600,
          x:          250,
          y:          20
        }); 
      }
    
    /**
     * Method to create a file or a folder.  It is recommended that
     * you use this by way of the intermediary functions 
     * #createFolder and #createFile.
     *
     * @see #createFolder
     * @see #createFile
     */
    this._create = function(url, targTyp, isFile)
      {
        var dispTyp = isFile ? 'file' : 'folder';
        
        /**
         * You must be adding to a collection, not a file.
         */
        if(targTyp == 'file')
          {
            return;  
          }
          
        /**
         * Create the Dav call object, which will be passed to
         * different method depending on whether we are creating
         * a file or a folder.
         */
        var ob = {
          scope: this,
          headers: {
            'If-None-Match': '*'
          },        
            
          onSuccess: function(r) {              
            this.refreshFolder(url);
          },
              
          onFailure: function(r) {
            if(r.getStatus() === 412)
              {
                MochaUI.notification("A " + dispTyp + " with that name already exists.");
              }
            else
              {
                MochaUI.notification("Unable to create " + dispTyp + ".");
              }
          }
        };
        
        if(isFile)
          {
            ob.body = '';
          }
          
        MochaUI.prompt({
          title:        'New ' + dispTyp,
          submitLabel:  'Create',
          message:  'Enter a name for this new ' + dispTyp + '.<br />It will be created in the folder > <b>' + url + '</b>:',
          callback: function(v){
            /**
             * If operating on the root, '/', folder, don't want to 
             * add the additional slash.
             */
            ob.url =  (url === '/') 
                      ? url + v
                      : url + '/' + v;
  
            if(isFile)
              {
                AXIS.WebDAV.PUT(ob); 
              }
            else
              {
                AXIS.WebDAV.MKCOL(ob);
              }
          }
        });
      };
    
    /** 
     * @see #_create
     */
    this.createFile = function(url, typ)
      {
        this._create(url, typ, true);
      };
      
    /** 
     * @see #_create
     */
    this.createFolder = function(url, typ)
      { 
        this._create(url, typ, false);
      };
  };