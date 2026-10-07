package com.echoisland.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

// 分享文件用的小 ContentProvider（不引入 androidx.core 的 FileProvider）：只读、只给 cache/share/ 里的文件，
// 地址 content://com.echoisland.app.share/<文件名>。shareText / shareFile 把存档写成文件交给微信等 App 时用，
// 对方拿到的是一次性的读权限（FLAG_GRANT_READ_URI_PERMISSION），别的 App 不能随便读（exported=false）。
public class ShareProvider extends ContentProvider {
    static File dir(Context c) {
        File d = new File(c.getCacheDir(), "share");
        if (!d.isDirectory()) d.mkdirs();
        return d;
    }

    static Uri uriFor(Context c, String name) {
        return new Uri.Builder().scheme("content").authority(c.getPackageName() + ".share").appendPath(name).build();
    }

    // 只认 cache/share/ 下面的普通文件名（不许 .. 和斜杠）
    static boolean okName(String n) {
        return n != null && n.matches("[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}");
    }

    private File fileFor(Uri u) {
        String n = u.getLastPathSegment();
        if (!okName(n) || getContext() == null) return null;
        File f = new File(dir(getContext()), n);
        return f.isFile() ? f : null;
    }

    static String mime(String name) {
        return name != null && name.endsWith(".json") ? "application/json" : "text/plain";
    }

    @Override public boolean onCreate() { return true; }

    @Override public String getType(Uri u) { return mime(u.getLastPathSegment()); }

    @Override
    public Cursor query(Uri u, String[] proj, String sel, String[] args, String sort) {
        File f = fileFor(u);
        if (f == null) return null;
        String[] cols = proj != null ? proj : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor c = new MatrixCursor(cols, 1);
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) row[i] = f.getName();
            else if (OpenableColumns.SIZE.equals(cols[i])) row[i] = f.length();
        }
        c.addRow(row);
        return c;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri u, String mode) throws FileNotFoundException {
        File f = fileFor(u);
        if (f == null) throw new FileNotFoundException(String.valueOf(u));
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Uri insert(Uri u, ContentValues v) { throw new UnsupportedOperationException("read only"); }

    @Override public int delete(Uri u, String s, String[] a) { return 0; }

    @Override public int update(Uri u, ContentValues v, String s, String[] a) { return 0; }
}
